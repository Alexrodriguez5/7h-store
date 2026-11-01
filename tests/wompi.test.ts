// @vitest-environment node
import { createHash } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { WompiGateway, checksumMatches } from "@/lib/payments/wompi";
import { applyPaymentEvent } from "@/lib/services/order-lifecycle";
import { detectProofType } from "@/lib/images";
import { createFakeDb } from "./helpers/fake-db";

const env = process.env as Record<string, string | undefined>;
const saved = env.WOMPI_EVENTS_SECRET;
beforeEach(() => { env.WOMPI_EVENTS_SECRET = "test_events_secret"; });
afterEach(() => { env.WOMPI_EVENTS_SECRET = saved; });

/** Evento con la forma documentada por Wompi (checksum en MAYÚSCULAS). */
function wompiEvent(over: { status?: string; reference?: string; id?: string; amount?: number; upper?: boolean; tamper?: boolean } = {}) {
  const transaction = { id: over.id ?? "1234-1610641025-49201", status: over.status ?? "APPROVED", amount_in_cents: over.amount ?? 4490000, reference: over.reference ?? "7H-2026-ABCD1234", currency: "COP" };
  const timestamp = 1530291411;
  const props = ["transaction.id", "transaction.status", "transaction.amount_in_cents"];
  const raw = `${transaction.id}${transaction.status}${transaction.amount_in_cents}${timestamp}test_events_secret`;
  let checksum = createHash("sha256").update(raw).digest("hex");
  if (over.upper !== false) checksum = checksum.toUpperCase();
  if (over.tamper) transaction.amount_in_cents += 100;
  return { event: "transaction.updated", data: { transaction }, signature: { properties: props, checksum }, timestamp, environment: "test" };
}
const post = (body: unknown, headers: Record<string, string> = {}) => new Request("http://x/api/webhooks/wompi", { method: "POST", body: JSON.stringify(body), headers });

describe("firma del webhook de Wompi", () => {
  it("acepta el checksum en MAYÚSCULAS tal como lo envía Wompi (antes se rechazaba)", async () => {
    const e = await new WompiGateway().verifyWebhook(post(wompiEvent()));
    expect(e).toMatchObject({ status: "APPROVED", publicCode: "7H-2026-ABCD1234", providerRef: "1234-1610641025-49201" });
  });
  it("también acepta minúsculas y la cabecera X-Event-Checksum", async () => {
    await expect(new WompiGateway().verifyWebhook(post(wompiEvent({ upper: false })))).resolves.toBeDefined();
    const body = wompiEvent();
    const checksum = body.signature.checksum;
    const { checksum: _drop, ...sig } = body.signature;
    void _drop;
    await expect(new WompiGateway().verifyWebhook(post({ ...body, signature: sig }, { "x-event-checksum": checksum }))).resolves.toBeDefined();
  });
  it("rechaza eventos manipulados, sin secreto o sin firma", async () => {
    await expect(new WompiGateway().verifyWebhook(post(wompiEvent({ tamper: true })))).rejects.toThrow("Firma inválida");
    const { signature: _s, ...unsigned } = wompiEvent();
    void _s;
    await expect(new WompiGateway().verifyWebhook(post(unsigned))).rejects.toThrow();
    delete env.WOMPI_EVENTS_SECRET;
    await expect(new WompiGateway().verifyWebhook(post(wompiEvent()))).rejects.toThrow();
  });
  it("en la tienda pública un pago Sandbox nunca marca el pedido como pagado", async () => {
    process.env.VERCEL_ENV = "production";
    try {
      await expect(new WompiGateway().verifyWebhook(post(wompiEvent()))).rejects.toThrow(/Sandbox/);
    } finally {
      delete process.env.VERCEL_ENV;
    }
  });
  it("ERROR y VOIDED cuentan como no aprobados", async () => {
    expect((await new WompiGateway().verifyWebhook(post(wompiEvent({ status: "ERROR" })))).status).toBe("DECLINED");
    expect((await new WompiGateway().verifyWebhook(post(wompiEvent({ status: "VOIDED" })))).status).toBe("DECLINED");
  });
  it("checksumMatches compara sin distinguir mayúsculas y rechaza formatos raros", () => {
    const h = "a".repeat(64);
    expect(checksumMatches(h, h.toUpperCase())).toBe(true);
    expect(checksumMatches(h, "b".repeat(64))).toBe(false);
    expect(checksumMatches(h, "zz")).toBe(false);
  });
});

describe("aplicación del pago", () => {
  it("un aprobado sin monto o en otra moneda NO marca el pedido como pagado", async () => {
    const f = createFakeDb();
    const o = f.seed.order({ totalCOP: 44_900 });
    expect(await applyPaymentEvent({ providerRef: "t1", status: "APPROVED", publicCode: o.publicCode, rawPayload: { data: { transaction: {} } } }, f.db)).toBe("amount_mismatch");
    expect(await applyPaymentEvent({ providerRef: "t2", status: "APPROVED", publicCode: o.publicCode, rawPayload: { data: { transaction: { amount_in_cents: 4_490_000, currency: "USD" } } } }, f.db)).toBe("amount_mismatch");
    expect(f.state.order[0].status).toBe("PENDING_PAYMENT");
    expect(await applyPaymentEvent({ providerRef: "t3", status: "APPROVED", publicCode: o.publicCode, rawPayload: { data: { transaction: { amount_in_cents: 4_490_000, currency: "COP" } } } }, f.db)).toBe("paid");
  });
});

describe("comprobantes de pago", () => {
  it("valida el tipo real: JPG, PNG y PDF sí; WebP, SVG/HTML no", () => {
    expect(detectProofType(new Uint8Array([0xff, 0xd8, 0xff, 0xe0]))?.mime).toBe("image/jpeg");
    expect(detectProofType(new Uint8Array([0x89, 0x50, 0x4e, 0x47]))?.mime).toBe("image/png");
    expect(detectProofType(new TextEncoder().encode("%PDF-1.7"))?.mime).toBe("application/pdf");
    expect(detectProofType(new TextEncoder().encode("<svg onload=alert(1)>"))).toBeNull();
    expect(detectProofType(new Uint8Array([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50]))).toBeNull();
  });
});
