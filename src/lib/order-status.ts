import type { OrderStatus } from "@prisma/client";

/**
 * Transiciones que puede ejecutar el administrador.
 * - PAID nunca se alcanza desde aquí por tarjeta/PSE: lo hace el webhook de Wompi.
 *   Para transferencia/consignación existe "confirmar pago manual" (servicio aparte).
 * - EXPIRED lo asigna únicamente el cron.
 */
export const ADMIN_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  PENDING_PAYMENT: ["CANCELLED"],
  PAID: ["PROCESSING", "CANCELLED"],
  PROCESSING: ["SHIPPED", "CANCELLED"],
  SHIPPED: ["DELIVERED"],
  DELIVERED: [],
  CANCELLED: [],
  EXPIRED: [],
};

export const canTransition = (from: OrderStatus, to: OrderStatus) => ADMIN_TRANSITIONS[from].includes(to);

export const ORDER_STATUS_LABEL: Record<OrderStatus, string> = {
  PENDING_PAYMENT: "Pendiente de pago",
  PAID: "Pagado",
  PROCESSING: "Preparando",
  SHIPPED: "Enviado",
  DELIVERED: "Entregado",
  CANCELLED: "Cancelado",
  EXPIRED: "Expirado",
};

export const PAYMENT_STATUS_LABEL = { PENDING: "Pendiente", APPROVED: "Aprobado", REJECTED: "Rechazado", FAILED: "Fallido" } as const;
export const PAYMENT_METHOD_LABEL = { CARD: "Tarjeta", PSE: "PSE", BANK_TRANSFER: "Transferencia", CASH_DEPOSIT: "Consignación" } as const;

/** Estados que cuentan como venta confirmada. */
export const REVENUE_STATUSES: OrderStatus[] = ["PAID", "PROCESSING", "SHIPPED", "DELIVERED"];

export type PaymentLike = { status: "PENDING" | "APPROVED" | "REJECTED" | "FAILED"; createdAt: Date };

/** Estado de pago visible: si alguna aprobación existe gana; si no, el último registro. */
export function derivePaymentStatus(payments: PaymentLike[]): PaymentLike["status"] | "NONE" {
  if (payments.length === 0) return "NONE";
  if (payments.some((p) => p.status === "APPROVED")) return "APPROVED";
  return [...payments].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0].status;
}
