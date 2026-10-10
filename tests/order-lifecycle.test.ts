import { beforeEach, describe, expect, it } from "vitest";
import { ADMIN_TRANSITIONS, canTransition, derivePaymentStatus } from "@/lib/order-status";
import { applyPaymentEvent, changeOrderStatus, confirmManualPayment, expireOrder } from "@/lib/services/order-lifecycle";
import { createFakeDb } from "./helpers/fake-db";

let f: ReturnType<typeof createFakeDb>;
const orderStatus = (id: string) => f.state.order.find((o) => o.id === id)!.status;
const variantStock = (id: string) => f.state.productVariant.find((v) => v.id === id)!.stock;

/** Pedido con 2 unidades reservadas de la talla 40 (stock restante 1). */
function reservedOrder(over: Record<string, unknown> = {}) {
  f.seed.category("calzado");
  const p = f.seed.product({ sizes: ["40"] });
  const v = f.seed.variant(p.id, "40", 1);
  const o = f.seed.order(over);
  f.seed.item(o.id, p.id, 2, v.id, "40");
  return { p, v, o };
}
beforeEach(() => { f = createFakeDb(); });

describe("máquina de estados", () => {
  it("sigue el flujo PAGADO → PREPARANDO → ENVIADO → ENTREGADO", () => {
    expect(canTransition("PAID", "PROCESSING")).toBe(true);
    expect(canTransition("PROCESSING", "SHIPPED")).toBe(true);
    expect(canTransition("SHIPPED", "DELIVERED")).toBe(true);
  });
  it("el admin no puede saltarse pasos ni reabrir estados finales", () => {
    expect(canTransition("PAID", "SHIPPED")).toBe(false);
    expect(canTransition("PENDING_PAYMENT", "PAID")).toBe(false);
    expect(canTransition("PENDING_PAYMENT", "EXPIRED")).toBe(false);
    for (const final of ["DELIVERED", "CANCELLED", "EXPIRED"] as const) expect(ADMIN_TRANSITIONS[final]).toEqual([]);
  });
  it("el estado de pago visible prioriza la aprobación", () => {
    const d = (n: number) => new Date(2026, 0, n);
    expect(derivePaymentStatus([])).toBe("NONE");
    expect(derivePaymentStatus([{ status: "PENDING", createdAt: d(1) }, { status: "FAILED", createdAt: d(2) }])).toBe("FAILED");
    expect(derivePaymentStatus([{ status: "APPROVED", createdAt: d(1) }, { status: "FAILED", createdAt: d(2) }])).toBe("APPROVED");
  });
});

describe("cambios de estado del administrador", () => {
  it("avanza PAID → PROCESSING → SHIPPED (con guía) → DELIVERED", async () => {
    const { o } = reservedOrder({ status: "PAID" });
    await changeOrderStatus({ orderId: o.id, to: "PROCESSING" }, f.db);
    await changeOrderStatus({ orderId: o.id, to: "SHIPPED", carrier: "Servientrega", trackingNumber: "ABC123" }, f.db);
    expect(f.state.order[0]).toMatchObject({ status: "SHIPPED", carrier: "Servientrega", trackingNumber: "ABC123" });
    await changeOrderStatus({ orderId: o.id, to: "DELIVERED" }, f.db);
    expect(orderStatus(o.id)).toBe("DELIVERED");
  });
  it("exige transportadora y guía para enviar", async () => {
    const { o } = reservedOrder({ status: "PROCESSING" });
    await expect(changeOrderStatus({ orderId: o.id, to: "SHIPPED" }, f.db)).rejects.toThrow("transportadora");
    expect(orderStatus(o.id)).toBe("PROCESSING");
  });
  it("rechaza transiciones inválidas", async () => {
    const { o } = reservedOrder({ status: "PAID" });
    await expect(changeOrderStatus({ orderId: o.id, to: "DELIVERED" }, f.db)).rejects.toThrow("No se puede pasar");
    await expect(changeOrderStatus({ orderId: "nope", to: "CANCELLED" }, f.db)).rejects.toThrow("no encontrado");
  });
  it("cancelar un pedido pendiente devuelve el stock reservado, una sola vez", async () => {
    const { o, v } = reservedOrder({ status: "PENDING_PAYMENT" });
    await changeOrderStatus({ orderId: o.id, to: "CANCELLED" }, f.db);
    expect(variantStock(v.id)).toBe(3);
    await expect(changeOrderStatus({ orderId: o.id, to: "CANCELLED" }, f.db)).rejects.toThrow();
    expect(variantStock(v.id)).toBe(3);
  });
  it("cancelar un pedido pagado solo repone si se indica", async () => {
    const a = reservedOrder({ status: "PAID" });
    await changeOrderStatus({ orderId: a.o.id, to: "CANCELLED", restock: false }, f.db);
    expect(variantStock(a.v.id)).toBe(1);
    const b = reservedOrder({ status: "PAID" });
    await changeOrderStatus({ orderId: b.o.id, to: "CANCELLED", restock: true }, f.db);
    expect(variantStock(b.v.id)).toBe(3);
  });
});

describe("pago manual (transferencia/consignación)", () => {
  it("confirma y deja el pago manual en APPROVED", async () => {
    const { o } = reservedOrder({ paymentMethod: "BANK_TRANSFER" });
    f.seed.payment({ orderId: o.id, status: "PENDING", amountCOP: 100_000, proofUrl: "data:image/png;base64,AA" });
    await confirmManualPayment(o.id, f.db);
    expect(orderStatus(o.id)).toBe("PAID");
    expect(f.state.payment[0].status).toBe("APPROVED");
  });
  it("NO permite confirmar manualmente pagos de tarjeta/PSE (los confirma el webhook)", async () => {
    for (const method of ["CARD", "PSE"]) {
      const { o } = reservedOrder({ paymentMethod: method });
      await expect(confirmManualPayment(o.id, f.db)).rejects.toThrow("Wompi");
      expect(orderStatus(o.id)).toBe("PENDING_PAYMENT");
    }
  });
  it("no confirma dos veces", async () => {
    const { o } = reservedOrder({ paymentMethod: "CASH_DEPOSIT" });
    await confirmManualPayment(o.id, f.db);
    await expect(confirmManualPayment(o.id, f.db)).rejects.toThrow();
  });
});

describe("webhook de Wompi", () => {
  const event = (o: { publicCode: string }, status: "APPROVED" | "DECLINED" | "PENDING", cents = 10_000_000, ref = "tx-1") => ({
    providerRef: ref, status, publicCode: o.publicCode, rawPayload: { data: { transaction: { amount_in_cents: cents } } },
  });
  it("APPROVED paga el pedido SIN tocar el stock", async () => {
    const { o, v } = reservedOrder();
    expect(await applyPaymentEvent(event(o, "APPROVED"), f.db)).toBe("paid");
    expect(orderStatus(o.id)).toBe("PAID");
    expect(variantStock(v.id)).toBe(1);
  });
  it("evento repetido no duplica nada", async () => {
    const { o, v } = reservedOrder();
    await applyPaymentEvent(event(o, "APPROVED"), f.db);
    expect(await applyPaymentEvent(event(o, "APPROVED"), f.db)).toBe("duplicate");
    expect(f.state.payment).toHaveLength(1);
    expect(variantStock(v.id)).toBe(1);
  });
  it("pago rechazado no cambia el pedido ni el stock", async () => {
    const { o, v } = reservedOrder();
    expect(await applyPaymentEvent(event(o, "DECLINED"), f.db)).toBe("recorded");
    expect(orderStatus(o.id)).toBe("PENDING_PAYMENT");
    expect(f.state.payment[0].status).toBe("FAILED");
    expect(variantStock(v.id)).toBe(1);
  });
  it("un aprobado tardío NO revive un pedido expirado (stock ya liberado)", async () => {
    const { o } = reservedOrder({ status: "EXPIRED" });
    expect(await applyPaymentEvent(event(o, "APPROVED"), f.db)).toBe("late_approval");
    expect(orderStatus(o.id)).toBe("EXPIRED");
    expect(f.state.payment[0].status).toBe("APPROVED"); // queda registrado para revisión
  });
  it("un aprobado repetido no hace retroceder un pedido ya enviado", async () => {
    const { o } = reservedOrder({ status: "SHIPPED" });
    await applyPaymentEvent(event(o, "APPROVED", 10_000_000, "tx-2"), f.db);
    expect(orderStatus(o.id)).toBe("SHIPPED");
  });
  it("rechaza aprobaciones con monto distinto al total", async () => {
    const { o } = reservedOrder();
    expect(await applyPaymentEvent(event(o, "APPROVED", 5_000), f.db)).toBe("amount_mismatch");
    expect(orderStatus(o.id)).toBe("PENDING_PAYMENT");
  });
  it("ignora referencias desconocidas", async () => {
    expect(await applyPaymentEvent({ providerRef: "x", status: "APPROVED", publicCode: "NOPE", rawPayload: {} }, f.db)).toBe("ignored");
  });
});

describe("expiración (cron)", () => {
  it("expira pedidos vencidos y repone el stock una sola vez", async () => {
    const { o, v } = reservedOrder({ expiresAt: new Date(Date.now() - 1000) });
    expect(await expireOrder(o.id, f.db)).toBe(true);
    expect(orderStatus(o.id)).toBe("EXPIRED");
    expect(variantStock(v.id)).toBe(3);
    expect(await expireOrder(o.id, f.db)).toBe(false);
    expect(variantStock(v.id)).toBe(3);
  });
  it("no expira un pedido que el webhook ya pagó", async () => {
    const { o, v } = reservedOrder({ status: "PAID", expiresAt: new Date(Date.now() - 1000) });
    expect(await expireOrder(o.id, f.db)).toBe(false);
    expect(orderStatus(o.id)).toBe("PAID");
    expect(variantStock(v.id)).toBe(1);
  });
  it("no expira pedidos que aún no vencen", async () => {
    const { o } = reservedOrder();
    expect(await expireOrder(o.id, f.db)).toBe(false);
  });
});
