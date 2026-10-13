import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin/guard";
import { handleError, parseBody } from "@/lib/admin/http";
import { createAdmin } from "@/lib/admin/auth";
import { audit } from "@/lib/admin/audit";
import { adminUserInput } from "@/lib/schemas/admin";

/** Solo un OWNER crea cuentas administrativas. No existe registro público. */
export async function POST(req: Request) {
  const { ctx, error } = await requireAdmin(req, { role: "OWNER" });
  if (error) return error;
  const body = await parseBody(req, adminUserInput);
  if ("error" in body) return body.error;
  try {
    const created = await createAdmin(body.data);
    await audit({ action: "admin.created", adminId: ctx.admin.id, actorEmail: ctx.admin.email, entityType: "admin", entityId: created.id, details: { email: created.email, role: created.role }, ip: ctx.ip });
    return NextResponse.json({ id: created.id }, { status: 201 });
  } catch (e) {
    return handleError(e);
  }
}
