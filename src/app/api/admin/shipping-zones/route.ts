import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin/guard";
import { handleError, parseBody } from "@/lib/admin/http";
import { audit } from "@/lib/admin/audit";
import { prisma } from "@/lib/prisma";
import { assertNoOverlap, invalidateShipping, shippingZoneInput } from "@/lib/services/shipping-zones";

/** Crea una zona de envío (tarifa y plazo para un grupo de departamentos). */
export async function POST(req: Request) {
  const { ctx, error } = await requireAdmin(req);
  if (error) return error;
  const body = await parseBody(req, shippingZoneInput);
  if ("error" in body) return body.error;
  try {
    await assertNoOverlap(body.data);
    const zone = await prisma.shippingZone.create({ data: body.data });
    invalidateShipping();
    await audit({ action: "shipping_zone.created", adminId: ctx.admin.id, actorEmail: ctx.admin.email, entityType: "shipping_zone", entityId: zone.id, details: body.data, ip: ctx.ip });
    return NextResponse.json({ zone }, { status: 201 });
  } catch (e) {
    return handleError(e);
  }
}
