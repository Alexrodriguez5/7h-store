// @vitest-environment node
import { describe, expect, it } from "vitest";
import { ORDER_CODE_RE, completedStep, normalizeOrderCode, validateTracking } from "@/lib/order-tracking";
import { amountToFreeShipping, FREE_SHIPPING_THRESHOLD } from "@/lib/shipping";

describe("Rastreo: normalización y validación", () => {
  it("normaliza mayúsculas, espacios y guiones", () => {
    expect(normalizeOrderCode(" 7h-2026-ab12cd34 ")).toBe("7H-2026-AB12CD34");
    expect(normalizeOrderCode("7H 2026 AB12CD34")).toBe("7H-2026-AB12CD34");
    expect(normalizeOrderCode("7h2026ab12cd34")).toBe("7H-2026-AB12CD34");
    expect(ORDER_CODE_RE.test(normalizeOrderCode("7h_2026_ab12cd34"))).toBe(true);
  });
  it("valida campos vacíos, formato del número y correo", () => {
    expect(validateTracking("", "")).toEqual({ code: expect.any(String), email: expect.any(String) });
    expect(validateTracking("12345", "ana@correo.co").code).toBeTruthy();
    expect(validateTracking("7H-2026-AB12CD34", "ana@correo").email).toBeTruthy();
    expect(validateTracking("7H-2026-AB12CD34", " Ana@Correo.co ")).toEqual({});
  });
  it("la línea de tiempo solo marca etapas alcanzadas", () => {
    expect(completedStep("pending_payment")).toBe(0);
    expect(completedStep("shipped")).toBe(3);
    expect(completedStep("delivered")).toBe(4);
    expect(completedStep("cancelled")).toBe(-1);
    expect(completedStep("expired")).toBe(-1);
  });
});

describe("Envío gratis en el carrito", () => {
  it("la barra se completa exactamente en el umbral", () => {
    expect(amountToFreeShipping(0)).toBe(FREE_SHIPPING_THRESHOLD);
    expect(amountToFreeShipping(FREE_SHIPPING_THRESHOLD)).toBe(0);
    expect(amountToFreeShipping(FREE_SHIPPING_THRESHOLD + 1)).toBe(0);
  });
});

describe("Número de pedido corto", () => {
  it("genera 7H-XXXXXX sin caracteres confusos y el rastreo lo acepta", async () => {
    const { newOrderCode } = await import("@/lib/services/orders");
    for (let i = 0; i < 200; i++) {
      const c = newOrderCode();
      expect(c).toMatch(/^7H-[23456789ABCDEFGHJKMNPQRSTWXYZ]{6}$/);
      expect(ORDER_CODE_RE.test(c)).toBe(true);
    }
    expect(normalizeOrderCode(" 7h k4m9qx ")).toBe("7H-K4M9QX");
    expect(validateTracking("7h-k4m9qx", "ana@correo.co")).toEqual({});
  });
});

describe("Envío mínimo con tarifa real", () => {
  it("por defecto $15.000", async () => {
    const { minShippingCOP } = await import("@/lib/services/shipping-quote");
    expect(minShippingCOP()).toBe(15000);
  });
});
