import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin/guard";
import { handleError, parseBody } from "@/lib/admin/http";
import { audit } from "@/lib/admin/audit";
import { productInput } from "@/lib/schemas/admin";
import { createProduct } from "@/lib/services/admin-products";
import { invalidateProducts } from "@/lib/cache";

export async function POST(req: Request) {
  const { ctx, error } = await requireAdmin(req);
  if (error) return error;
  const body = await parseBody(req, productInput);
  if ("error" in body) return body.error;
  try {
    const product = await createProduct(body.data);
    invalidateProducts();
    await audit({ action: "product.created", adminId: ctx.admin.id, actorEmail: ctx.admin.email, entityType: "product", entityId: product.id, details: { name: product.name, slug: product.slug, priceCOP: product.priceCOP, stock: product.stock }, ip: ctx.ip });
    return NextResponse.json({ id: product.id, slug: product.slug }, { status: 201 });
  } catch (e) {
    return handleError(e);
  }
}
