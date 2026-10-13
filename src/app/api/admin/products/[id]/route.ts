import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin/guard";
import { handleError, parseBody } from "@/lib/admin/http";
import { audit } from "@/lib/admin/audit";
import { productInput, toggleActiveInput } from "@/lib/schemas/admin";
import { deleteProduct, setProductActive, updateProduct } from "@/lib/services/admin-products";
import { cleanupImages } from "@/lib/services/image-cleanup";
import { invalidateProducts } from "@/lib/cache";

type Ctx = { params: Promise<{ id: string }> };

export async function PUT(req: Request, { params }: Ctx) {
  const { ctx, error } = await requireAdmin(req);
  if (error) return error;
  const body = await parseBody(req, productInput);
  if ("error" in body) return body.error;
  const { id } = await params;
  try {
    const product = await updateProduct(id, body.data);
    invalidateProducts();
    await audit({ action: "product.updated", adminId: ctx.admin.id, actorEmail: ctx.admin.email, entityType: "product", entityId: id, details: { name: product.name, priceCOP: product.priceCOP, active: product.active }, ip: ctx.ip });
    if (product.removedImages.length) await cleanupImages(product.removedImages);
    return NextResponse.json({ id: product.id, slug: product.slug });
  } catch (e) {
    return handleError(e);
  }
}

/** Activar / desactivar (no elimina nada). */
export async function PATCH(req: Request, { params }: Ctx) {
  const { ctx, error } = await requireAdmin(req);
  if (error) return error;
  const body = await parseBody(req, toggleActiveInput);
  if ("error" in body) return body.error;
  const { id } = await params;
  try {
    await setProductActive(id, body.data.active);
    invalidateProducts();
    await audit({ action: body.data.active ? "product.activated" : "product.deactivated", adminId: ctx.admin.id, actorEmail: ctx.admin.email, entityType: "product", entityId: id, ip: ctx.ip });
    return NextResponse.json({ ok: true, active: body.data.active });
  } catch (e) {
    return handleError(e);
  }
}

export async function DELETE(req: Request, { params }: Ctx) {
  const { ctx, error } = await requireAdmin(req);
  if (error) return error;
  const { id } = await params;
  try {
    const p = await deleteProduct(id);
    invalidateProducts();
    await audit({ action: "product.deleted", adminId: ctx.admin.id, actorEmail: ctx.admin.email, entityType: "product", entityId: id, details: { name: p.name }, ip: ctx.ip });
    await cleanupImages(p.images);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return handleError(e);
  }
}
