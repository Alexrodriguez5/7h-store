import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/admin/guard";
import { handleError, parseBody } from "@/lib/admin/http";
import { audit } from "@/lib/admin/audit";
import { SupportError, applyStaffAction } from "@/lib/services/support";
import { SUPPORT_STATUS } from "@/lib/support";
import type { SupportStatus } from "@prisma/client";

const schema = z.object({
  status: z.enum(Object.keys(SUPPORT_STATUS) as [SupportStatus, ...SupportStatus[]]).optional(),
  message: z.string().trim().max(4000).optional(),
  note: z.string().trim().max(4000).optional(),
  assignedAdminId: z.string().max(64).nullable().optional(),
  resolution: z.string().trim().max(4000).optional(),
  refundAmountCOP: z.number().int().min(0).max(100_000_000).nullable().optional(),
  refundReference: z.string().trim().max(120).nullable().optional(),
});

/** Gestión de una solicitud por el equipo. Registrar un reembolso NO mueve dinero: solo deja constancia (el reembolso real se hace en Wompi o el banco). */
export async function PATCH(req: Request, { params }: { params: Promise<{ code: string }> }) {
  const { ctx, error } = await requireAdmin(req);
  if (error) return error;
  const body = await parseBody(req, schema);
  if ("error" in body) return body.error;
  const { code } = await params;
  try {
    await applyStaffAction(code, ctx.admin.id, body.data);
    await audit({ action: "support.updated", adminId: ctx.admin.id, actorEmail: ctx.admin.email, entityType: "support", entityId: code, details: { ...body.data, note: body.data.note ? "(nota interna)" : undefined }, ip: ctx.ip });
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof SupportError) return NextResponse.json({ error: e.message }, { status: e.status });
    return handleError(e);
  }
}
