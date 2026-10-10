import type { OrderStatus, PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { canTransition } from "@/lib/order-status";
import { claimTransition, releaseOrderStock } from "@/lib/stock";

export class LifecycleError extends Error {
  constructor(public code: "NOT_FOUND" | "INVALID_TRANSITION" | "MISSING_TRACKING" | "MANUAL_ONLY" | "NOT_MANUAL", message: string) {
    super(message);
  }
}

/** Expira un pedido vencido y devuelve su stock. Idempotente y seguro frente a pagos simultáneos. */
export async function expireOrder(orderId: string, db: PrismaClient = prisma): Promise<boolean> {
  return db.$transaction(async (tx) => {
    // Solo expira si SIGUE pendiente y vencido: si el webhook lo pagó entre tanto, no se toca.
    const ok = await claimTransition(tx, orderId, "PENDING_PAYMENT", { status: "EXPIRED" }, { expiresAt: { lt: new Date() } });
    if (!ok) return false;
    await releaseOrderStock(tx, orderId);
    return true;
  });
}

export interface PaymentEvent {
  providerRef: string;
  status: "APPROVED" | "DECLINED" | "PENDING";
  publicCode: string;
  rawPayload: unknown;
}

export type PaymentEventResult = "ignored" | "duplicate" | "paid" | "recorded" | "late_approval" | "amount_mismatch";

function amountInCentsOf(raw: unknown): number | undefined {
  const data = (raw as { data?: { transaction?: { amount_in_cents?: unknown } } } | null)?.data;
  const v = data?.transaction?.amount_in_cents;
  return typeof v === "number" ? v : undefined;
}

/**
 * Aplica un evento ya verificado (firma) de Wompi.
 * - Solo PENDING_PAYMENT puede pasar a PAID: un aprobado tardío sobre un pedido
 *   expirado/cancelado NO lo revive (su stock ya fue liberado); queda registrado para revisión.
 * - Verifica el monto contra el total del pedido.
 * - Eventos repetidos no producen cambios.
 */
export async function applyPaymentEvent(event: PaymentEvent, db: PrismaClient = prisma): Promise<PaymentEventResult> {
  return db.$transaction(async (tx) => {
    const order = await tx.order.findUnique({ where: { publicCode: event.publicCode } });
    if (!order) return "ignored";

    const paymentId = `wompi-${event.providerRef}`;
    const existing = await tx.payment.findUnique({ where: { id: paymentId } });
    if (existing?.status === "APPROVED") return "duplicate";

    const cents = amountInCentsOf(event.rawPayload);
    const mismatch = event.status === "APPROVED" && cents !== undefined && cents !== order.totalCOP * 100;
    const paymentStatus = mismatch ? "FAILED" : event.status === "APPROVED" ? "APPROVED" : event.status === "DECLINED" ? "FAILED" : "PENDING";
    const rawPayload = JSON.parse(JSON.stringify(event.rawPayload));

    await tx.payment.upsert({
      where: { id: paymentId },
      update: { status: paymentStatus, rawPayload },
      create: { id: paymentId, orderId: order.id, provider: "wompi", providerRef: event.providerRef, status: paymentStatus, amountCOP: order.totalCOP, rawPayload },
    });

    if (mismatch) return "amount_mismatch";
    if (event.status !== "APPROVED") return "recorded";
    const paid = await claimTransition(tx, order.id, "PENDING_PAYMENT", { status: "PAID" });
    return paid ? "paid" : "late_approval";
  });
}

export interface StatusChangeInput {
  orderId: string;
  to: OrderStatus;
  carrier?: string;
  trackingNumber?: string;
  /** Al cancelar un pedido ya pagado: devolver las unidades al inventario. */
  restock?: boolean;
}

/** Cambio de estado hecho por el administrador, validado contra la máquina de estados. */
export async function changeOrderStatus(input: StatusChangeInput, db: PrismaClient = prisma) {
  return db.$transaction(async (tx) => {
    const order = await tx.order.findUnique({ where: { id: input.orderId } });
    if (!order) throw new LifecycleError("NOT_FOUND", "Pedido no encontrado.");
    const previous = order.status; // snapshot del estado antes de la transición
    if (!canTransition(previous, input.to)) {
      throw new LifecycleError("INVALID_TRANSITION", `No se puede pasar de ${previous} a ${input.to}.`);
    }
    const data: { status: OrderStatus; carrier?: string; trackingNumber?: string } = { status: input.to };
    if (input.to === "SHIPPED") {
      const carrier = input.carrier?.trim();
      const trackingNumber = input.trackingNumber?.trim();
      if (!carrier || !trackingNumber) throw new LifecycleError("MISSING_TRACKING", "Indica la transportadora y el número de guía.");
      data.carrier = carrier;
      data.trackingNumber = trackingNumber;
    }
    // El candado evita que dos clicks/pestañas apliquen la misma transición dos veces.
    const ok = await claimTransition(tx, order.id, previous, data);
    if (!ok) throw new LifecycleError("INVALID_TRANSITION", "El pedido cambió de estado. Recarga e inténtalo de nuevo.");
    if (input.to === "CANCELLED" && (previous === "PENDING_PAYMENT" || input.restock)) {
      await releaseOrderStock(tx, order.id);
    }
    return tx.order.findUniqueOrThrow({ where: { id: order.id } });
  });
}

/**
 * Confirmación manual de pago: SOLO transferencia y consignación.
 * Tarjeta/PSE los confirma exclusivamente el webhook de Wompi.
 */
export async function confirmManualPayment(orderId: string, db: PrismaClient = prisma) {
  return db.$transaction(async (tx) => {
    const order = await tx.order.findUnique({ where: { id: orderId } });
    if (!order) throw new LifecycleError("NOT_FOUND", "Pedido no encontrado.");
    if (order.paymentMethod !== "BANK_TRANSFER" && order.paymentMethod !== "CASH_DEPOSIT") {
      throw new LifecycleError("NOT_MANUAL", "Los pagos con tarjeta o PSE solo los confirma Wompi.");
    }
    const ok = await claimTransition(tx, order.id, "PENDING_PAYMENT", { status: "PAID" });
    if (!ok) throw new LifecycleError("INVALID_TRANSITION", "Solo se pueden confirmar pedidos pendientes de pago.");
    const manual = await tx.payment.findFirst({ where: { orderId: order.id, provider: "manual" }, orderBy: { createdAt: "desc" } });
    if (manual) await tx.payment.update({ where: { id: manual.id }, data: { status: "APPROVED" } });
    else await tx.payment.create({ data: { orderId: order.id, provider: "manual", status: "APPROVED", amountCOP: order.totalCOP } });
    return tx.order.findUniqueOrThrow({ where: { id: order.id } });
  });
}
