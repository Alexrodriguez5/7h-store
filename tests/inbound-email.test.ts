// @vitest-environment node
/** Correo entrante (Resend → webhook con firma Svix): solo se asocia al caso si lo envía el mismo cliente. */
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { createHmac } from "node:crypto";
import { createFakeDb } from "./helpers/fake-db";

const h = vi.hoisted(() => ({ f: undefined as unknown as ReturnType<typeof createFakeDb>, mails: [] as unknown[] }));
vi.mock("@/lib/prisma", () => ({ get prisma() { return h.f.db; } }));
vi.mock("@/lib/mailer", () => ({ deliverLater: (m: unknown) => h.mails.push(m), supportInbox: () => "soporte@7h.test" }));

import { POST } from "@/app/api/webhooks/correo-entrante/route";

const SECRET_BYTES = Buffer.from("clave-de-prueba-para-webhooks-0123456789");
process.env.RESEND_WEBHOOK_SECRET = `whsec_${SECRET_BYTES.toString("base64")}`;
afterAll(() => { delete process.env.RESEND_WEBHOOK_SECRET; });

const send = (payload: unknown, opts: { badSig?: boolean; ts?: number } = {}) => {
  const body = JSON.stringify(payload);
  const id = "msg_1";
  const ts = String(opts.ts ?? Math.floor(Date.now() / 1000));
  const sig = createHmac("sha256", opts.badSig ? Buffer.from("otra") : SECRET_BYTES).update(`${id}.${ts}.${body}`).digest("base64");
  return POST(new Request("http://localhost:3000/api/webhooks/correo-entrante", { method: "POST", headers: { "svix-id": id, "svix-timestamp": ts, "svix-signature": `v1,${sig}` }, body }));
};
const mail = (from: string, subject = "Re: [SOL-2026-000001] Actualización") => ({ type: "email.received", data: { from, subject, text: "Adjunto la foto que pidieron." } });

beforeEach(() => {
  h.f = createFakeDb();
  h.mails = [];
  h.f.state.supportRequest.push({ id: "r1", code: "SOL-2026-000001", contactEmail: "ana@correo.co", status: "INFO_SOLICITADA" });
});

describe("/api/webhooks/correo-entrante", () => {
  it("rechaza firmas inválidas o viejas", async () => {
    expect((await send(mail("ana@correo.co"), { badSig: true })).status).toBe(400);
    expect((await send(mail("ana@correo.co"), { ts: Math.floor(Date.now() / 1000) - 3600 })).status).toBe(400);
    expect(h.f.state.supportEvent).toHaveLength(0);
  });
  it("agrega el correo del cliente al historial y reabre la revisión", async () => {
    const res = await send(mail("Ana Pérez <ANA@correo.co>"));
    expect(await res.json()).toMatchObject({ linked: true });
    expect(h.f.state.supportEvent[0]).toMatchObject({ kind: "email_in", authorType: "customer" });
    expect(h.f.state.supportRequest[0].status).toBe("EN_REVISION");
  });
  it("si lo envía otra persona no se asocia y se avisa al equipo", async () => {
    const res = await send(mail("intruso@otro.co"));
    expect(await res.json()).toMatchObject({ linked: false });
    expect(h.f.state.supportEvent).toHaveLength(0);
    expect(h.mails).toHaveLength(1);
  });
});
