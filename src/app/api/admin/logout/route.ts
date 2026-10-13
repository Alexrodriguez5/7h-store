import { NextResponse } from "next/server";
import { clearSessionCookie } from "@/lib/admin/session";
import { requireAdmin } from "@/lib/admin/guard";
import { revokeSession } from "@/lib/admin/auth";
import { audit } from "@/lib/admin/audit";

export async function POST(req: Request) {
  const { ctx, error } = await requireAdmin(req);
  if (error) {
    // Aunque la sesión ya no sea válida, se borra la cookie del navegador.
    const res = NextResponse.json({ ok: true });
    clearSessionCookie(res);
    return res;
  }
  await revokeSession(ctx.admin.sessionId);
  await audit({ action: "auth.logout", adminId: ctx.admin.id, actorEmail: ctx.admin.email, ip: ctx.ip });
  const res = NextResponse.json({ ok: true });
  clearSessionCookie(res);
  return res;
}
