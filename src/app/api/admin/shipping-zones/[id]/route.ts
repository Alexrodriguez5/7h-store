import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin/guard";
import { handleError, parseBody } from "@/lib/admin/http";
import { audit } from "@/lib/admin/audit";
import { prisma } from "@/lib/prisma";
import { assertNoOverlap, invalidateShipping, shippingZoneInput } from "@/lib/services/shipping-zones";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, { params }: Ctx) {
  const { ctx, error } = await requireAdmin(req);
  if (error) return error;
  const body = await parseBody(req, shippingZoneInput);
  if ("error" in body) return body.error;
  const { id } = await params;
  try {
    await assertNoOverlap(body.data, id);
    const zone = await prisma.shippingZone.update({ where: { id }, data: body.data });
    invalidateShipping();
    await audit({ action: "shipping_zone.updated", adminId: ctx.admin.id, actorEmail: ctx.admin.email, entityType: "shipping_zone", entityId: id, details: body.data, ip: ctx.ip });
    return NextResponse.json({ zone });
  } catch (e) {
    return handleError(e);
  }
}

/** Eliminar una zona no afecta pedidos ya creados (guardan su propio costo de envío). */
export async function DELETE(req: Request, { params }: Ctx) {
  const { ctx, error } = await requireAdmin(req);
  if (error) return error;
  const { id } = await params;
  try {
    const zone = await prisma.shippingZone.delete({ where: { id } });
    invalidateShipping();
    await audit({ action: "shipping_zone.deleted", adminId: ctx.admin.id, actorEmail: ctx.admin.email, entityType: "shipping_zone", entityId: id, details: { name: zone.name }, ip: ctx.ip });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return handleError(e);
  }
}
