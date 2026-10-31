// @vitest-environment node
/** Ruta pública /api/orders/lookup contra la base de datos en memoria (sin Supabase). */
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { createFakeDb } from "./helpers/fake-db";

const h = vi.hoisted(() => ({ f: undefined as unknown as ReturnType<typeof createFakeDb> }));
vi.mock("@/lib/prisma", () => ({ get prisma() { return h.f.db; } }));

import { MemoryRateStore, setRateStore } from "@/lib/rate-limit";
import { POST as lookup } from "@/app/api/orders/lookup/route";

const call = (body: unknown, ip = "10.0.0.9") =>
  new Request("http://localhost:3000/api/orders/lookup", { method: "POST", headers: { "content-type": "application/json", "x-real-ip": ip }, body: JSON.stringify(body) });

beforeEach(() => {
  h.f = createFakeDb();
  setRateStore(new MemoryRateStore());
  h.f.state.order.push({
    id: "ord1", publicCode: "7H-2026-AB12CD34", status: "SHIPPED", paymentMethod: "CARD", customerFullName: "Ana Pérez", customerEmail: "ana@correo.co",
    customerPhone: "3001234567", documentType: "CC", documentNumber: "123", department: "Meta", city: "Villavicencio", address: "Calle 1",
    subtotalCOP: 100000, shippingCOP: 18000, totalCOP: 118000, trackingNumber: "999", carrier: "Servientrega", shippingZone: null, shippingEta: "5 a 10 días hábiles",
    expiresAt: new Date(), createdAt: new Date(),
    // La base en memoria no resuelve `include`: los ítems van en la fila.
    items: [{ id: "it1", orderId: "ord1", name: "Tenis", size: "40", quantity: 1, unitPriceCOP: 100000 }], payments: [],
  });
});
afterAll(() => setRateStore(undefined));

describe("/api/orders/lookup", () => {
  it("encuentra el pedido con número normalizado y correo en otro formato, sin datos sensibles", async () => {
    const res = await lookup(call({ publicCode: " 7h 2026 ab12cd34 ", email: " ANA@correo.co " }));
    expect(res.status).toBe(200);
    const { order } = await res.json();
    expect(order.publicCode).toBe("7H-2026-AB12CD34");
    expect(order.status).toBe("shipped");
    expect(order.trackingNumber).toBe("999");
    expect(order.firstName).toBe("Ana");
    expect(JSON.stringify(order)).not.toMatch(/3001234567|Calle 1|customerEmail|documentNumber/);
  });
  it("pedido inexistente y correo distinto responden igual (no permite adivinar)", async () => {
    const a = await lookup(call({ publicCode: "7H-2026-FFFFFFFF", email: "ana@correo.co" }));
    const b = await lookup(call({ publicCode: "7H-2026-AB12CD34", email: "otro@correo.co" }));
    expect(a.status).toBe(404);
    expect(b.status).toBe(404);
    expect(await a.json()).toEqual(await b.json());
  });
  it("rechaza formatos inválidos", async () => {
    expect((await lookup(call({ publicCode: "abc", email: "ana@correo.co" }))).status).toBe(400);
    expect((await lookup(call({ publicCode: "7H-2026-AB12CD34", email: "no-es-correo" }))).status).toBe(400);
  });
  it("limita las consultas por IP", async () => {
    let last = 0;
    for (let i = 0; i < 21; i++) last = (await lookup(call({ publicCode: "7H-2026-FFFFFFFF", email: "x@correo.co" }, "10.9.9.9"))).status;
    expect(last).toBe(429);
  });
});
