import { NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/admin/guard";
import { handleError, parseBody } from "@/lib/admin/http";
import { productInput } from "@/lib/schemas/admin";
import { createProduct } from "@/lib/services/admin-products";

export async function POST(req: Request) {
  const denied = await requireAdminApi(req);
  if (denied) return denied;
  const body = await parseBody(req, productInput);
  if ("error" in body) return body.error;
  try {
    const product = await createProduct(body.data);
    return NextResponse.json({ id: product.id, slug: product.slug }, { status: 201 });
  } catch (e) {
    return handleError(e);
  }
}
