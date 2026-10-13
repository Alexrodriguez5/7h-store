import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin/guard";
import { handleError, parseBody } from "@/lib/admin/http";
import { audit } from "@/lib/admin/audit";
import { categoryUpdateInput } from "@/lib/schemas/admin";
import { deleteCategory, updateCategory } from "@/lib/services/categories";
import { invalidateCategories } from "@/lib/cache";

type Ctx = { params: Promise<{ id: string }> };

/** Edita nombre, orden, imagen o visibilidad. El slug no se cambia (es parte de los enlaces públicos). */
export async function PATCH(req: Request, { params }: Ctx) {
  const { ctx, error } = await requireAdmin(req);
  if (error) return error;
  const body = await parseBody(req, categoryUpdateInput);
  if ("error" in body) return body.error;
  const { id } = await params;
  try {
    const c = await updateCategory(id, body.data);
    invalidateCategories();
    await audit({ action: "category.updated", adminId: ctx.admin.id, actorEmail: ctx.admin.email, entityType: "category", entityId: id, details: body.data, ip: ctx.ip });
    return NextResponse.json({ category: c });
  } catch (e) {
    return handleError(e);
  }
}

export async function DELETE(req: Request, { params }: Ctx) {
  const { ctx, error } = await requireAdmin(req);
  if (error) return error;
  const { id } = await params;
  try {
    const c = await deleteCategory(id);
    invalidateCategories();
    await audit({ action: "category.deleted", adminId: ctx.admin.id, actorEmail: ctx.admin.email, entityType: "category", entityId: id, details: { label: c.label }, ip: ctx.ip });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return handleError(e);
  }
}
