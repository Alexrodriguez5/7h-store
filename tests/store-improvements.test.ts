// @vitest-environment node
import { createHash } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { WompiGateway, orderPageUrl } from "@/lib/payments/wompi";
import { jsonLdScript } from "@/lib/seo";
import { checkoutSchema } from "@/lib/schemas/checkout";
import { useCartStore } from "@/store/cart-store";
import type { Product } from "@/types";

const env = process.env as Record<string, string | undefined>;
const saved = { site: env.NEXT_PUBLIC_SITE_URL, pub: env.WOMPI_PUBLIC_KEY, integ: env.WOMPI_INTEGRITY_SECRET };
beforeEach(() => {
  env.WOMPI_PUBLIC_KEY = "pub_test_abc";
  env.WOMPI_INTEGRITY_SECRET = "test_integrity_abc";
});
afterEach(() => {
  env.NEXT_PUBLIC_SITE_URL = saved.site;
  env.WOMPI_PUBLIC_KEY = saved.pub;
  env.WOMPI_INTEGRITY_SECRET = saved.integ;
});

describe("Wompi: regreso del cliente", () => {
  it("agrega redirect-url a la página del pedido sin alterar la firma de integridad", async () => {
    env.NEXT_PUBLIC_SITE_URL = "https://7hstore.co/";
    const { redirectUrl } = await new WompiGateway().createCheckout({ id: "o1", publicCode: "7H-2026-ABCD1234", totalCOP: 44900, customerEmail: "a@b.co", paymentMethod: "card" });
    const u = new URL(redirectUrl);
    expect(u.searchParams.get("redirect-url")).toBe("https://7hstore.co/pedido/7H-2026-ABCD1234");
    expect(u.searchParams.get("amount-in-cents")).toBe("4490000");
    const expected = createHash("sha256").update("7H-2026-ABCD12344490000COPtest_integrity_abc").digest("hex");
    expect(u.searchParams.get("signature:integrity")).toBe(expected);
  });
  it("sin NEXT_PUBLIC_SITE_URL https no envía redirect-url", () => {
    env.NEXT_PUBLIC_SITE_URL = "";
    expect(orderPageUrl("7H-1")).toBeNull();
    env.NEXT_PUBLIC_SITE_URL = "javascript:alert(1)";
    expect(orderPageUrl("7H-1")).toBeNull();
    // Wompi bloquea (403) redirect-url hacia http://localhost: en desarrollo no se envía.
    env.NEXT_PUBLIC_SITE_URL = "http://localhost:3000";
    expect(orderPageUrl("7H-1")).toBeNull();
  });
});

describe("Datos estructurados", () => {
  it("no permite cerrar la etiqueta <script> desde un texto", () => {
    const out = jsonLdScript({ description: '</script><script>alert(1)</script> & "x"' });
    expect(out).not.toContain("<");
    expect(out).not.toContain(">");
    expect(JSON.parse(out).description).toBe('</script><script>alert(1)</script> & "x"');
  });
});

describe("Checkout: límites de longitud", () => {
  const valid = {
    customer: { fullName: "Ana Pérez", email: "ana@correo.co", phone: "3001234567", documentType: "CC", documentNumber: "1234567" },
    shipping: { department: "Antioquia", city: "Medellín", address: "Calle 10 # 20-30" },
    paymentMethod: "card",
    terms: true,
    items: [{ productId: "p1", quantity: 1 }],
  } as const;
  it("acepta un pedido normal", () => expect(checkoutSchema.safeParse(valid).success).toBe(true));
  it("rechaza textos desmesurados", () => {
    expect(checkoutSchema.safeParse({ ...valid, shipping: { ...valid.shipping, address: "x".repeat(201) } }).success).toBe(false);
    expect(checkoutSchema.safeParse({ ...valid, shipping: { ...valid.shipping, notes: "x".repeat(501) } }).success).toBe(false);
    expect(checkoutSchema.safeParse({ ...valid, items: Array.from({ length: 51 }, (_, i) => ({ productId: `p${i}`, quantity: 1 })) }).success).toBe(false);
  });
});

describe("Carrito: agregar varias unidades", () => {
  const product: Product = { id: "p1", slug: "p1", name: "Producto", brand: "Marca", description: "", priceCOP: 100000, category: "tecnologia", gender: "unisex", isAccessory: false, images: ["x"], stock: 3, tags: [] };
  beforeEach(() => useCartStore.setState({ items: [], isOpen: false }));
  it("suma la cantidad elegida sin pasar el stock", () => {
    useCartStore.getState().addItem(product, undefined, 2);
    expect(useCartStore.getState().items[0].quantity).toBe(2);
    useCartStore.getState().addItem(product, undefined, 5);
    expect(useCartStore.getState().items[0].quantity).toBe(3);
  });
  it("sin cantidad agrega una unidad (comportamiento anterior)", () => {
    useCartStore.getState().addItem(product);
    expect(useCartStore.getState().items[0].quantity).toBe(1);
  });
});

describe("Correos al cliente", () => {
  it("arma el correo de envío con transportadora y guía, escapando HTML", async () => {
    const { buildOrderEmail } = await import("@/lib/order-emails");
    const mail = buildOrderEmail("shipped", {
      publicCode: "7H-2026-ABCD1234", customerFullName: "Ana <b>Pérez</b>", customerEmail: "ana@correo.co", paymentMethod: "CARD",
      subtotalCOP: 100000, shippingCOP: 18000, totalCOP: 118000, carrier: "Servientrega", trackingNumber: "123456789",
      city: "Pereira", department: "Risaralda", address: "Calle 1", expiresAt: new Date("2026-11-01T12:00:00Z"),
      items: [{ name: "Tenis", size: "40", quantity: 1, unitPriceCOP: 100000 }],
    });
    expect(mail.subject).toContain("va en camino");
    expect(mail.text).toContain("Servientrega");
    expect(mail.text).toContain("123456789");
    expect(mail.html).not.toContain("<b>Pérez");
    expect(mail.html).toContain("/pedido/7H-2026-ABCD1234");
  });
  it("sin Resend configurado no intenta enviar", async () => {
    const { notifyCustomer } = await import("@/lib/order-emails");
    delete env.RESEND_API_KEY;
    expect(() => notifyCustomer("paid", { id: "x" })).not.toThrow();
  });
});
