import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/admin/guard";
import { audit } from "@/lib/admin/audit";
import { readJson } from "@/lib/request";
import { REQUEST_STATUS_ORDER, updateProductRequest } from "@/lib/services/product-requests";
import type { ProductRequestStatus } from "@prisma/client";

const schema = z.object({
  status: z.enum(REQUEST_STATUS_ORDER as [ProductRequestStatus, ...ProductRequestStatus[]]).optional(),
  reply: z.string().trim().min(5, "Escribe una respuesta").max(2000).optional(),
  productId: z.string().max(40).nullable().optional(),
});

/** Cambiar estado, responder al cliente (por correo) o enlazar el producto creado. */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const g = await requireAdmin(req);
  if (g.error) return g.error;
  const parsed = schema.safeParse(await readJson(req));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Datos no válidos" }, { status: 400 });
  const { id } = await params;
  try {
    const r = await updateProductRequest(id, parsed.data);
    await audit({ action: "product_request.updated", adminId: g.ctx.admin.id, actorEmail: g.ctx.admin.email, entityType: "product_request", entityId: r.code, details: { status: parsed.data.status, replied: !!parsed.data.reply }, ip: g.ctx.ip });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Solicitud no encontrada." }, { status: 404 });
  }
}
