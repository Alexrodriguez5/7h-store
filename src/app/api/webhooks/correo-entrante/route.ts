import { NextResponse } from "next/server";
import { createHmac, timingSafeEqual } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { deliverLater, supportInbox } from "@/lib/mailer";

/**
 * Correos que llegan a atención (Resend Inbound → webhook "email.received").
 * Si el asunto contiene un radicado (SOL-2026-000123) y el remitente es el cliente del caso, el mensaje
 * se agrega al historial de la solicitud. Firma verificada con RESEND_WEBHOOK_SECRET (formato Svix).
 */
function verifySvix(body: string, headers: Headers, secret: string): boolean {
  const id = headers.get("svix-id");
  const ts = headers.get("svix-timestamp");
  const sigs = headers.get("svix-signature");
  if (!id || !ts || !sigs) return false;
  if (Math.abs(Date.now() / 1000 - Number(ts)) > 300) return false;
  const key = Buffer.from(secret.replace(/^whsec_/, ""), "base64");
  const expected = createHmac("sha256", key).update(`${id}.${ts}.${body}`).digest();
  return sigs.split(" ").some((s) => {
    const v = s.split(",")[1];
    if (!v) return false;
    const got = Buffer.from(v, "base64");
    return got.length === expected.length && timingSafeEqual(got, expected);
  });
}

const CODE_RE = /SOL-\d{4}-\d{6}/;
const emailOf = (from: string) => (from.match(/<([^>]+)>/)?.[1] ?? from).trim().toLowerCase();

export async function POST(req: Request) {
  const secret = process.env.RESEND_WEBHOOK_SECRET;
  if (!secret) return NextResponse.json({ error: "No configurado" }, { status: 503 });
  const raw = await req.text();
  if (!verifySvix(raw, req.headers, secret)) return NextResponse.json({ error: "Firma inválida" }, { status: 400 });
  let evt: { type?: string; data?: { from?: string; subject?: string; text?: string } };
  try {
    evt = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }
  if (evt.type !== "email.received" || !evt.data) return NextResponse.json({ ok: true, ignored: true });
  const subject = evt.data.subject ?? "";
  const code = subject.match(CODE_RE)?.[0];
  const from = emailOf(evt.data.from ?? "");
  const text = (evt.data.text ?? "").slice(0, 8000).trim();
  if (!code) return NextResponse.json({ ok: true, linked: false });
  const sr = await prisma.supportRequest.findUnique({ where: { code } });
  // Solo se asocia si lo escribe el mismo cliente del caso (evita que terceros inserten mensajes).
  if (!sr || sr.contactEmail !== from) {
    const inbox = supportInbox();
    if (inbox) deliverLater({ to: inbox, kind: "support.inbound_unmatched", ref: code, subject: `[Revisar] Correo con ${code} de ${from}`, heading: "Correo recibido sin asociar", paragraphs: [`De: ${from}`, `Asunto: ${subject}`, "El remitente no coincide con el cliente del caso; revísalo manualmente."] });
    return NextResponse.json({ ok: true, linked: false });
  }
  await prisma.$transaction([
    prisma.supportEvent.create({ data: { requestId: sr.id, kind: "email_in", authorType: "customer", body: text || "(correo sin texto)", visibleToCustomer: true } }),
    prisma.supportRequest.update({ where: { id: sr.id }, data: { ...(sr.status === "INFO_SOLICITADA" ? { status: "EN_REVISION" } : {}), updatedAt: new Date() } }),
  ]);
  return NextResponse.json({ ok: true, linked: true });
}
