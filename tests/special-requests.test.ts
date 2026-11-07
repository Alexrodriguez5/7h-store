import { createHash } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({ prisma: {} }));
const mail = vi.hoisted(() => ({ sent: [] as unknown[] }));
vi.mock("@/lib/mailer", () => ({ deliverLater: (m: unknown) => mail.sent.push(m), supportInbox: () => "equipo@7hstore.app" }));

import { productRequestInput } from "@/lib/services/product-requests";
import { alternativeInput, assertCustomOfferPurchase, canAccess, customerAct, customerActionInput, RequestError } from "@/lib/services/special-requests";

/* eslint-disable @typescript-eslint/no-explicit-any */
const sha = (t: string) => createHash("sha256").update(t).digest("hex");
const day = 86_400_000;
const req = { id: "r1", email: "ana@correo.co", customerId: null as string | null };

function tokenDb(rows: Record<string, { requestId: string; expiresAt: Date; revokedAt: Date | null }>) {
  return { requestAccessToken: { findUnique: async ({ where }: any) => rows[where.tokenHash] ?? null } } as any;
}

beforeEach(() => { mail.sent = []; });

describe("acceso a una solicitud", () => {
  it("el dueño verificado entra por su cuenta o por su correo", async () => {
    const db = tokenDb({});
    const owner = { id: "c1", email: "ana@correo.co", emailVerifiedAt: new Date() };
    expect(await canAccess(req, { customer: owner }, db)).toBe(true);
    expect(await canAccess({ ...req, email: "otro@x.co", customerId: "c1" }, { customer: owner }, db)).toBe(true);
  });
  it("una cuenta con el mismo correo SIN verificar no entra", async () => {
    expect(await canAccess(req, { customer: { id: "c9", email: "ana@correo.co", emailVerifiedAt: null } }, tokenDb({}))).toBe(false);
  });
  it("el enlace seguro funciona solo si es de esta solicitud, vigente y no revocado", async () => {
    const db = tokenDb({
      [sha("bueno")]: { requestId: "r1", expiresAt: new Date(Date.now() + day), revokedAt: null },
      [sha("vencido")]: { requestId: "r1", expiresAt: new Date(Date.now() - 1000), revokedAt: null },
      [sha("revocado")]: { requestId: "r1", expiresAt: new Date(Date.now() + day), revokedAt: new Date() },
      [sha("ajeno")]: { requestId: "r2", expiresAt: new Date(Date.now() + day), revokedAt: null },
    });
    expect(await canAccess(req, { token: "bueno" }, db)).toBe(true);
    for (const t of ["vencido", "revocado", "ajeno", "inventado", ""]) expect(await canAccess(req, { token: t }, db)).toBe(false);
    expect(await canAccess(req, { token: "x".repeat(101) }, db)).toBe(false);
  });
});

describe("entrada del cliente", () => {
  const base = { name: "Ana", email: "ANA@correo.co ", productName: "iPhone 15 Pro", consent: true as const };
  it("acepta información parcial y normaliza el correo", () => {
    const r = productRequestInput.parse(base);
    expect(r.email).toBe("ana@correo.co");
    expect(r.links).toEqual([]);
    expect(r.source).toBe("formulario");
  });
  it("exige consentimiento y rechaza enlaces que no sean http(s)", () => {
    expect(productRequestInput.safeParse({ ...base, consent: false }).success).toBe(false);
    expect(productRequestInput.safeParse({ ...base, links: ["javascript:alert(1)"] }).success).toBe(false);
    expect(productRequestInput.safeParse({ ...base, links: Array(6).fill("https://a.co") }).success).toBe(false);
  });
  it("aceptar no permite enviar precio ni condiciones desde el navegador", () => {
    const r = customerActionInput.parse({ action: "accept", alternativeId: "a1", priceCOP: 1 } as any);
    expect(r).toEqual({ action: "accept", alternativeId: "a1" });
  });
  it("cada alternativa declara si el precio es estimado, cotizado o final", () => {
    const alt = { name: "iPhone 15 Pro", brand: null, model: null, imageUrl: null, description: null, referenceUrl: null, priceCOP: 5_000_000, extraCostsCOP: null, shippingCOP: null, availability: null, deliveryEstimate: null, warranty: null, validUntil: null, notes: null, internalNotes: null };
    expect(alternativeInput.safeParse({ ...alt, priceKind: "COTIZADO" }).success).toBe(true);
    expect(alternativeInput.safeParse({ ...alt, priceKind: "BARATO" }).success).toBe(false);
    expect(alternativeInput.safeParse({ ...alt, priceKind: "FINAL", referenceUrl: "javascript:x" }).success).toBe(false);
  });
});

describe("el cliente acepta una alternativa", () => {
  function db(alt: any, status = "ESPERANDO_CLIENTE") {
    const calls: string[] = [];
    const d: any = {
      productRequest: { findUnique: async () => ({ id: "r1", code: "BUS-2026-000001", status, productName: "iPhone", name: "Ana", email: "ana@correo.co" }), update: async () => { calls.push("request.update"); return {}; } },
      requestAlternative: { findFirst: async ({ where }: any) => (alt && where.status === alt.status && where.id === alt.id ? alt : null), update: async () => { calls.push("alt.update"); return {}; } },
      requestEvent: { create: async () => { calls.push("event"); return {}; } },
      $transaction: async (ops: unknown[]) => Promise.all(ops),
    };
    return { d, calls };
  }
  it("registra la aceptación de una alternativa enviada y vigente", async () => {
    const { d, calls } = db({ id: "a1", status: "ENVIADA", name: "iPhone 15 Pro", priceKind: "COTIZADO", priceCOP: 5000000, validUntil: new Date(Date.now() + day) });
    await customerAct("r1", { action: "accept", alternativeId: "a1" }, d);
    expect(calls).toContain("alt.update");
    expect(mail.sent.length).toBeGreaterThan(0);
  });
  it("rechaza una alternativa vencida", async () => {
    const { d } = db({ id: "a1", status: "ENVIADA", name: "x", validUntil: new Date(Date.now() - 1000) });
    await expect(customerAct("r1", { action: "accept", alternativeId: "a1" }, d)).rejects.toThrow(/vigencia/);
  });
  it("no se puede aceptar un borrador que el cliente no ha visto", async () => {
    const { d } = db({ id: "a1", status: "BORRADOR", name: "x", validUntil: null });
    await expect(customerAct("r1", { action: "accept", alternativeId: "a1" }, d)).rejects.toBeInstanceOf(RequestError);
  });
  it("una solicitud cerrada no recibe acciones", async () => {
    const { d } = db(null, "CONVERTIDA");
    await expect(customerAct("r1", { action: "message", body: "hola equipo" }, d)).rejects.toThrow(/cerrada/);
  });
});

describe("compra de una oferta privada", () => {
  const offer = (o: any = {}) => ({ id: "o1", status: "ACTIVA", expiresAt: new Date(Date.now() + day), customerEmail: "ana@correo.co", orderId: null, ...o });
  const tx = (o: any, orderStatus?: string) => ({ customOffer: { findUnique: async () => o }, order: { findUnique: async () => (orderStatus ? { status: orderStatus } : null) } }) as any;
  it("solo la compra el cliente dueño, una unidad, mientras está activa", async () => {
    expect(await assertCustomOfferPurchase(tx(offer()), "p1", " ANA@correo.co", 1)).toBe("o1");
    await expect(assertCustomOfferPurchase(tx(offer()), "p1", "otro@correo.co", 1)).rejects.toThrow("CUSTOM_OFFER_OWNER");
    await expect(assertCustomOfferPurchase(tx(offer()), "p1", "ana@correo.co", 2)).rejects.toThrow("CUSTOM_OFFER_QUANTITY");
    await expect(assertCustomOfferPurchase(tx(offer({ expiresAt: new Date(Date.now() - 1) })), "p1", "ana@correo.co", 1)).rejects.toThrow("CUSTOM_OFFER_UNAVAILABLE");
    await expect(assertCustomOfferPurchase(tx(offer({ status: "REVOCADA" })), "p1", "ana@correo.co", 1)).rejects.toThrow("CUSTOM_OFFER_UNAVAILABLE");
    await expect(assertCustomOfferPurchase(tx(null), "p1", "ana@correo.co", 1)).rejects.toThrow("CUSTOM_OFFER_UNAVAILABLE");
  });
  it("no se puede pagar dos veces; sí se reintenta si el pedido anterior venció", async () => {
    await expect(assertCustomOfferPurchase(tx(offer({ orderId: "ord1" }), "PENDING_PAYMENT"), "p1", "ana@correo.co", 1)).rejects.toThrow("CUSTOM_OFFER_IN_USE");
    expect(await assertCustomOfferPurchase(tx(offer({ orderId: "ord1" }), "EXPIRED"), "p1", "ana@correo.co", 1)).toBe("o1");
  });
});
