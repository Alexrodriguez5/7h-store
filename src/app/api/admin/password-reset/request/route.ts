import { NextResponse } from "next/server";
import { z } from "zod";
import { RESET_TTL_MS, createPasswordReset, normalizeEmail } from "@/lib/admin/auth";
import { audit } from "@/lib/admin/audit";
import { isEmailConfigured, passwordResetEmail, sendEmail, siteUrl } from "@/lib/email";
import { MIN, consume, hashedKey } from "@/lib/rate-limit";
import { getClientIp, isSameOrigin, readJson } from "@/lib/request";

const schema = z.object({ email: z.string().trim().email().max(200) });
const GENERIC = "Si el correo pertenece a un administrador activo, te enviamos un enlace para restablecer la contraseña. Revisa también la carpeta de spam.";

/** Respuesta SIEMPRE igual (no revela si la cuenta existe). */
export async function POST(req: Request) {
  if (!isSameOrigin(req)) return NextResponse.json({ error: "Origen no permitido" }, { status: 403 });
  if (!isEmailConfigured()) {
    return NextResponse.json({ error: "La recuperación por correo no está configurada. Pide al dueño de la tienda que restablezca tu contraseña desde el panel." }, { status: 503 });
  }
  const parsed = schema.safeParse(await readJson(req));
  if (!parsed.success) return NextResponse.json({ error: "Escribe un correo válido." }, { status: 400 });
  const email = normalizeEmail(parsed.data.email);
  const ip = getClientIp(req);

  const byIp = await consume(`reset:ip:${ip}`, 10, 60 * MIN);
  const byEmail = await consume(hashedKey("reset:email", email), 3, 60 * MIN);
  // Si se superó el límite, igual se responde lo mismo, pero no se envía nada.
  if (!byIp.allowed || !byEmail.allowed) return NextResponse.json({ ok: true, message: GENERIC });

  try {
    const r = await createPasswordReset(email);
    if (r) {
      const link = `${siteUrl()}/admin/restablecer?token=${encodeURIComponent(r.token)}`;
      const sent = await sendEmail({ to: r.admin.email, ...passwordResetEmail(r.admin.name, link, RESET_TTL_MS / MIN) });
      await audit({ action: "auth.password_reset_requested", adminId: r.admin.id, actorEmail: r.admin.email, details: { sent }, ip });
    }
  } catch (e) {
    console.error("[password-reset] error:", e instanceof Error ? e.message : e);
  }
  return NextResponse.json({ ok: true, message: GENERIC });
}
