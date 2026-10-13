import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin/guard";
import { handleError, parseBody } from "@/lib/admin/http";
import { AuthError, createSession, setPassword } from "@/lib/admin/auth";
import { verifyPassword } from "@/lib/admin/password";
import { setSessionCookie } from "@/lib/admin/session";
import { audit } from "@/lib/admin/audit";
import { changePasswordInput } from "@/lib/schemas/admin";
import { prisma } from "@/lib/prisma";
import { MIN, consume, tooMany } from "@/lib/rate-limit";
import { getUserAgent } from "@/lib/request";

/** Cambia la contraseña propia (pide la actual), cierra las demás sesiones y renueva la de este dispositivo. */
export async function POST(req: Request) {
  const { ctx, error } = await requireAdmin(req);
  if (error) return error;
  const body = await parseBody(req, changePasswordInput);
  if ("error" in body) return body.error;
  const limit = await consume(`account:pw:${ctx.admin.id}`, 5, 15 * MIN);
  if (!limit.allowed) return tooMany(limit.retryAfterSec);
  try {
    const me = await prisma.adminUser.findUnique({ where: { id: ctx.admin.id }, select: { passwordHash: true } });
    if (!me || !(await verifyPassword(body.data.currentPassword, me.passwordHash))) throw new AuthError(400, "La contraseña actual no es correcta.");
    await setPassword(ctx.admin.id, body.data.newPassword);
    await audit({ action: "auth.password_changed", adminId: ctx.admin.id, actorEmail: ctx.admin.email, ip: ctx.ip });
    const res = NextResponse.json({ ok: true });
    setSessionCookie(res, await createSession(ctx.admin.id, { ip: ctx.ip, userAgent: getUserAgent(req) }));
    return res;
  } catch (e) {
    return handleError(e);
  }
}
