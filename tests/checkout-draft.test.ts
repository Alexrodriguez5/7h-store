import { describe, expect, it } from "vitest";
import { CHECKOUT_DRAFT_KEY, clearDraft, loadDraft, sanitizeDraft, saveDraft } from "@/lib/checkout-draft";

const memory = () => {
  const m = new Map<string, string>();
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), removeItem: (k: string) => void m.delete(k), raw: m };
};

const values = {
  customer: { fullName: "Ana Pérez", email: "ana@example.com", phone: "3001234567", documentType: "CC", documentNumber: "123456789" },
  shipping: { department: "Meta", city: "Villavicencio", address: "Calle 1 # 2-3", notes: "Portería" },
  paymentMethod: "pse",
  terms: true,
  attemptKey: "abcdefghijklmnop",
  items: [{ productId: "p1", quantity: 1 }],
  card: { number: "4242424242424242", cvc: "123" },
};

describe("borrador del checkout (BUG-08)", () => {
  it("guarda y recupera solo los campos permitidos", () => {
    const s = memory();
    saveDraft(values, s, 1000);
    const d = loadDraft(s, 2000)!;
    expect(d.customer).toEqual({ fullName: "Ana Pérez", email: "ana@example.com", phone: "3001234567", documentType: "CC" });
    expect(d.shipping.city).toBe("Villavicencio");
    expect(d.paymentMethod).toBe("pse");
  });

  it("nunca almacena documento, términos, clave de intento, ítems ni datos de tarjeta", () => {
    const s = memory();
    saveDraft(values, s, 1000);
    const raw = s.raw.get(CHECKOUT_DRAFT_KEY)!;
    for (const secret of ["123456789", "4242424242424242", "\"123\"", "terms", "abcdefghijklmnop", "productId"]) expect(raw).not.toContain(secret);
  });

  it("caduca a las 2 horas y se borra", () => {
    const s = memory();
    saveDraft(values, s, 0);
    expect(loadDraft(s, 2 * 3600_000 + 1)).toBeNull();
    expect(s.raw.has(CHECKOUT_DRAFT_KEY)).toBe(false);
  });

  it("ignora contenido corrupto o de otra versión", () => {
    const s = memory();
    s.setItem(CHECKOUT_DRAFT_KEY, "{no-json");
    expect(loadDraft(s)).toBeNull();
    s.setItem(CHECKOUT_DRAFT_KEY, JSON.stringify({ v: 99, at: Date.now(), draft: values }));
    expect(loadDraft(s)).toBeNull();
  });

  it("un formulario vacío no deja borrador y clearDraft lo elimina", () => {
    const s = memory();
    saveDraft(values, s);
    saveDraft({ customer: {}, shipping: {} }, s);
    expect(s.raw.has(CHECKOUT_DRAFT_KEY)).toBe(false);
    saveDraft(values, s);
    clearDraft(s);
    expect(loadDraft(s)).toBeNull();
  });

  it("rechaza métodos de pago desconocidos y valores no textuales", () => {
    expect(sanitizeDraft({ paymentMethod: "bitcoin", customer: { fullName: 5 } })).toEqual({ customer: {}, shipping: {} });
  });

  it("funciona sin almacenamiento (modo privado o servidor)", () => {
    expect(() => saveDraft(values, null)).not.toThrow();
    expect(loadDraft(null)).toBeNull();
  });
});
