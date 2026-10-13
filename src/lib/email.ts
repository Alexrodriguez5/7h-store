/**
 * Correo transaccional mediante la API REST de Resend (https://resend.com), sin dependencias.
 * Variables (solo servidor): RESEND_API_KEY y EMAIL_FROM (p. ej. "7H STORE <no-responder@tudominio.com>").
 * Si no están configuradas, NO se simula ningún envío: las funciones informan que el correo está desactivado.
 */
export const isEmailConfigured = () => !!process.env.RESEND_API_KEY && !!process.env.EMAIL_FROM;

export async function sendEmail(msg: { to: string; subject: string; text: string; html: string }, fetchImpl: typeof fetch = fetch): Promise<boolean> {
  if (!isEmailConfigured()) return false;
  try {
    const res = await fetchImpl("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: process.env.EMAIL_FROM, to: [msg.to], subject: msg.subject, text: msg.text, html: msg.html }),
    });
    if (!res.ok) console.error("[email] el proveedor respondió", res.status);
    return res.ok;
  } catch (e) {
    console.error("[email] no se pudo enviar:", e instanceof Error ? e.message : e);
    return false;
  }
}

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

export function passwordResetEmail(name: string, link: string, minutes: number) {
  const subject = "Restablece tu contraseña · Admin 7H STORE";
  const text = `Hola ${name},\n\nRecibimos una solicitud para restablecer tu contraseña del panel de 7H STORE.\nAbre este enlace (vence en ${minutes} minutos y solo sirve una vez):\n${link}\n\nSi no fuiste tú, ignora este correo: tu contraseña no cambiará.`;
  const html = `<div style="font-family:Arial,sans-serif;max-width:520px;color:#0a0a0a"><p style="font-size:20px;letter-spacing:3px;color:#c9a44c"><strong>7H STORE</strong></p><p>Hola ${esc(name)},</p><p>Recibimos una solicitud para restablecer tu contraseña del panel administrativo.</p><p><a href="${esc(link)}" style="display:inline-block;background:#0a0a0a;color:#f5f1e8;padding:12px 18px;text-decoration:none">Restablecer contraseña</a></p><p style="font-size:12px;color:#555">El enlace vence en ${minutes} minutos y solo sirve una vez. Si no fuiste tú, ignora este correo.</p></div>`;
  return { subject, text, html };
}

/** URL pública del sitio para enlaces en correos. */
export function siteUrl(): string {
  return (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/$/, "");
}
