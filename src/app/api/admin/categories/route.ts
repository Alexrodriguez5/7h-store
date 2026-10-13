import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin/guard";
import { handleError, parseBody } from "@/lib/admin/http";
import { audit } from "@/lib/admin/audit";
import { categoryCreateInput } from "@/lib/schemas/admin";
import { createCategory } from "@/lib/services/categories";
import { invalidateCategories } from "@/lib/cache";

export async function POST(req: Request) {
  const { ctx, error } = await requireAdmin(req);
  if (error) return error;
  const body = await parseBody(req, categoryCreateInput);
  if ("error" in body) return body.error;
  try {
    const c = await createCategory(body.data);
    invalidateCategories();
    await audit({ action: "category.created", adminId: ctx.admin.id, actorEmail: ctx.admin.email, entityType: "category", entityId: c.id, details: { slug: c.slug, label: c.label }, ip: ctx.ip });
    return NextResponse.json({ category: c }, { status: 201 });
  } catch (e) {
    return handleError(e);
  }
}
