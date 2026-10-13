import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin/guard";
import { handleError, parseBody } from "@/lib/admin/http";
import { AuthError, revokeAllSessions, setAdminActive, setAdminRole, setPassword } from "@/lib/admin/auth";
import { audit } from "@/lib/admin/audit";
import { adminUserAction } from "@/lib/schemas/admin";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { ctx, error } = await requireAdmin(req, { role: "OWNER" });
  if (error) return error;
  const body = await parseBody(req, adminUserAction);
  if ("error" in body) return body.error;
  const { id } = await params;
  const a = body.data;
  const base = { adminId: ctx.admin.id, actorEmail: ctx.admin.email, entityType: "admin", entityId: id, ip: ctx.ip };
  try {
    if (a.action === "activate" || a.action === "deactivate") {
      await setAdminActive(ctx.admin.id, id, a.action === "activate");
      await audit({ ...base, action: a.action === "activate" ? "admin.activated" : "admin.deactivated" });
    } else if (a.action === "role") {
      await setAdminRole(ctx.admin.id, id, a.role);
      await audit({ ...base, action: "admin.role_changed", details: { role: a.role } });
    } else if (a.action === "reset_password") {
      if (id === ctx.admin.id) throw new AuthError(409, "Para tu propia cuenta usa «Mi cuenta».");
      await setPassword(id, a.password);
      await audit({ ...base, action: "admin.password_reset_by_owner" });
    } else {
      const n = await revokeAllSessions(id);
      await audit({ ...base, action: "admin.sessions_revoked", details: { sessions: n } });
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    return handleError(e);
  }
}
