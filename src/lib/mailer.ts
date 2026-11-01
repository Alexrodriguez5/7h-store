import { after } from "next/server";
import { prisma } from "@/lib/prisma";
import { isEmailConfigured, sendEmail } from "@/lib/email";
import { siteUrl } from "@/lib/seo";
import { BUSINESS } from "@/lib/business";

/**
 * Correos transaccionales con la marca 7H STORE, registrados en EmailLog (para ver fallos y reintentar).
 * Nunca incluyen contraseñas ni datos de tarjetas. Los enlaces van a páginas que piden iniciar sesión.
 */
export interface Mail {
  to: string;
  subject: string;
  /** p. ej. "account.verify", "support.created" */
  kind: string;
  /** Número de pedido o radicado. */
  ref?: string;
  heading: string;
  paragraphs: string[];
  cta?: { label: string; path: string };
  /** Bloque destacado (p. ej. el código OTP). */
  highlight?: string;
}

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

export function renderMail(m: Mail) {
  const url = m.cta ? `${siteUrl()}${m.cta.path}` : null;
  const contact = [BUSINESS.email, BUSINESS.whatsapp ? `WhatsApp +${BUSINESS.whatsapp}` : null].filter(Boolean).join(" · ");
  const text = [m.heading, "", ...m.paragraphs, ...(m.highlight ? ["", m.highlight] : []), ...(url ? ["", `${m.cta!.label}: ${url}`] : []), "", contact, "7H STORE · Calidad. Estilo. Confianza."].join("\n");
  const html = `<div style="font-family:Arial,Helvetica,sans-serif;max-width:560px;margin:auto;color:#0a0a0a;background:#f5f1e8;padding:24px">
<p style="font-size:22px;letter-spacing:4px;color:#c9a44c;margin:0 0 18px"><strong>7H STORE</strong></p>
<h1 style="font-size:20px;margin:0 0 12px">${esc(m.heading)}</h1>
${m.paragraphs.map((p) => `<p style="line-height:1.6;margin:0 0 10px">${esc(p)}</p>`).join("")}
${m.highlight ? `<p style="font-size:28px;letter-spacing:8px;font-weight:bold;background:#0a0a0a;color:#d8b866;text-align:center;padding:14px;border-radius:12px">${esc(m.highlight)}</p>` : ""}
${url ? `<p style="margin:18px 0"><a href="${esc(url)}" style="display:inline-block;background:#0a0a0a;color:#f5f1e8;padding:12px 20px;border-radius:999px;text-decoration:none">${esc(m.cta!.label)}</a></p>` : ""}
<p style="font-size:12px;color:#555;line-height:1.6">${esc(contact)}<br>7H STORE · Calidad. Estilo. Confianza.</p></div>`;
  return { text, html };
}

/** Envía y registra el resultado. Devuelve true si el proveedor aceptó el correo. */
export async function deliver(m: Mail): Promise<boolean> {
  if (!isEmailConfigured()) {
    await log(m, "skipped", "Resend sin configurar");
    return false;
  }
  const ok = await sendEmail({ to: m.to, subject: m.subject, ...renderMail(m) });
  await log(m, ok ? "sent" : "failed", ok ? null : "El proveedor rechazó o no respondió");
  return ok;
}

async function log(m: Mail, status: string, error: string | null) {
  try {
    await prisma.emailLog.create({ data: { to: m.to, subject: m.subject.slice(0, 200), kind: m.kind, ref: m.ref ?? null, status, error } });
  } catch (e) {
    console.error("[mailer] no se pudo registrar:", e instanceof Error ? e.message : e);
  }
}

/** Envía después de responder (no bloquea ni hace fallar la operación). */
export function deliverLater(m: Mail) {
  const task = () => deliver(m).catch((e) => console.error("[mailer]", e instanceof Error ? e.message : e));
  try {
    after(task);
  } catch {
    void task();
  }
}

/** Buzón del equipo de atención (recibe avisos de nuevas solicitudes). */
export const supportInbox = () => process.env.SUPPORT_INBOX_EMAIL?.trim() || BUSINESS.email || null;
