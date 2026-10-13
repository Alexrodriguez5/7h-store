import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin/guard";
import { revokeAllSessions } from "@/lib/admin/auth";
import { clearSessionCookie } from "@/lib/admin/session";
import { audit } from "@/lib/admin/audit";

/** Cierra la sesión en todos los dispositivos (incluido este). */
export async function POST(req: Request) {
  const { ctx, error } = await requireAdmin(req);
  if (error) return error;
  const n = await revokeAllSessions(ctx.admin.id);
  await audit({ action: "auth.logout_all", adminId: ctx.admin.id, actorEmail: ctx.admin.email, details: { sessions: n }, ip: ctx.ip });
  const res = NextResponse.json({ ok: true });
  clearSessionCookie(res);
  return res;
}
