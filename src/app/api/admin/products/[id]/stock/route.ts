import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin/guard";
import { handleError, parseBody } from "@/lib/admin/http";
import { audit } from "@/lib/admin/audit";
import { stockInput } from "@/lib/schemas/admin";
import { setStock } from "@/lib/services/admin-products";
import { invalidateProducts } from "@/lib/cache";

/** Devuelve el stock actualizado para que la fila del inventario se refresque sin recargar toda la página. */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { ctx, error } = await requireAdmin(req);
  if (error) return error;
  const body = await parseBody(req, stockInput);
  if ("error" in body) return body.error;
  const { id } = await params;
  try {
    const r = await setStock(id, body.data);
    invalidateProducts();
    await audit({ action: "product.stock_updated", adminId: ctx.admin.id, actorEmail: ctx.admin.email, entityType: "product", entityId: id, details: { total: r.stock, ...("variants" in body.data ? { variants: r.variants.map((v) => `${v.size}=${v.stock}`) } : {}) }, ip: ctx.ip });
    return NextResponse.json({ ok: true, stock: r.stock, variants: r.variants });
  } catch (e) {
    return handleError(e);
  }
}
