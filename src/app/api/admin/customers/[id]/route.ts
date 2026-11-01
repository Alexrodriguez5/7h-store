import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/admin/guard";
import { handleError, parseBody } from "@/lib/admin/http";
import { audit } from "@/lib/admin/audit";
import { prisma } from "@/lib/prisma";
import { revokeCustomerSessions } from "@/lib/customer/auth";

const schema = z.object({ blocked: z.boolean(), reason: z.string().trim().max(500).optional() });

/** Bloquear o desbloquear a un cliente. Bloquear cierra todas sus sesiones (no afecta sus pedidos). */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { ctx, error } = await requireAdmin(req);
  if (error) return error;
  const body = await parseBody(req, schema);
  if ("error" in body) return body.error;
  const { id } = await params;
  try {
    const c = await prisma.customer.update({ where: { id }, data: { blockedAt: body.data.blocked ? new Date() : null } });
    if (body.data.blocked) await revokeCustomerSessions(id);
    await audit({ action: body.data.blocked ? "customer.blocked" : "customer.unblocked", adminId: ctx.admin.id, actorEmail: ctx.admin.email, entityType: "customer", entityId: id, details: { email: c.email, reason: body.data.reason }, ip: ctx.ip });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return handleError(e);
  }
}
