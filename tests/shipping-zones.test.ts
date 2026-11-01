// @vitest-environment node
import { describe, expect, it } from "vitest";
import { FLAT_SHIPPING_COP, quoteShipping, totalWeight, type ShippingZoneRule } from "@/lib/shipping";
import { shippingZoneInput } from "@/lib/services/shipping-zones";
import { createOrder } from "@/lib/services/orders";
import { createFakeDb } from "./helpers/fake-db";
import type { PrismaClient } from "@prisma/client";

const llanos: ShippingZoneRule = { name: "Llanos", departments: ["Meta", "Casanare"], priceCOP: 12000, baseWeightGrams: 1000, extraPerKgCOP: 3000, minDays: 1, maxDays: 3 };
const resto: ShippingZoneRule = { name: "Resto del país", departments: ["Antioquia"], priceCOP: 20000, baseWeightGrams: 2000, extraPerKgCOP: 0, minDays: 5, maxDays: 10 };

describe("Cotización de envío por zona y peso", () => {
  it("usa la tarifa de la zona del departamento y su plazo", () => {
    expect(quoteShipping({ subtotalCOP: 100000, weightGrams: 800, department: "Meta", zones: [llanos, resto] })).toEqual({ costCOP: 12000, zone: "Llanos", eta: "1 a 3 días hábiles", free: false });
  });
  it("cobra cada kg adicional o fracción sobre el peso incluido", () => {
    expect(quoteShipping({ subtotalCOP: 100000, weightGrams: 2500, department: "Meta", zones: [llanos] }).costCOP).toBe(12000 + 2 * 3000);
  });
  it("es gratis desde el umbral aunque haya zona", () => {
    const q = quoteShipping({ subtotalCOP: 500000, weightGrams: 9000, department: "Meta", zones: [llanos] });
    expect(q.costCOP).toBe(0);
    expect(q.free).toBe(true);
  });
  it("sin zona para el destino usa la tarifa histórica (comportamiento anterior)", () => {
    expect(quoteShipping({ subtotalCOP: 100000, weightGrams: 1000, department: "Nariño", zones: [llanos] }).costCOP).toBe(FLAT_SHIPPING_COP);
    expect(quoteShipping({ subtotalCOP: 100000, weightGrams: 1000, department: "Meta", zones: [] }).costCOP).toBe(FLAT_SHIPPING_COP);
  });
  it("los productos sin peso cuentan como 1 kg", () => {
    expect(totalWeight([{ weightGrams: null, quantity: 2 }, { weightGrams: 300, quantity: 1 }])).toBe(2300);
  });
});

describe("Validación de zonas", () => {
  const ok = { name: "Llanos", departments: ["Meta"], priceCOP: 12000, minDays: 1, maxDays: 3 };
  it("acepta una zona válida", () => expect(shippingZoneInput.safeParse(ok).success).toBe(true));
  it("rechaza departamentos inexistentes, precios negativos y plazos invertidos", () => {
    expect(shippingZoneInput.safeParse({ ...ok, departments: ["Narnia"] }).success).toBe(false);
    expect(shippingZoneInput.safeParse({ ...ok, priceCOP: -1 }).success).toBe(false);
    expect(shippingZoneInput.safeParse({ ...ok, minDays: 5, maxDays: 2 }).success).toBe(false);
  });
});

describe("El pedido cobra el envío en el servidor con el peso real", () => {
  it("aplica la zona y guarda zona y plazo en el pedido", async () => {
    const fake = createFakeDb();
    const p = fake.seed.product({ priceCOP: 100000, stock: 5, weightGrams: 2500 });
    const order = await createOrder(
      {
        customer: { fullName: "Ana Pérez", email: "ana@correo.co", phone: "3001234567", documentType: "CC", documentNumber: "1234567" },
        shipping: { department: "Meta", city: "Villavicencio", address: "Calle 10 # 20-30" },
        paymentMethod: "card",
        terms: true,
        items: [{ productId: p.id as string, quantity: 1 }],
      },
      fake.db as unknown as PrismaClient,
      [llanos],
    );
    expect(order.shippingCOP).toBe(12000 + 2 * 3000);
    expect(order.totalCOP).toBe(100000 + 18000);
    expect((order as unknown as { shippingZone: string }).shippingZone).toBe("Llanos");
  });
});
