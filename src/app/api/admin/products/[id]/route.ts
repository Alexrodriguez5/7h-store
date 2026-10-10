import { NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/admin/guard";
import { handleError, parseBody } from "@/lib/admin/http";
import { productInput, toggleActiveInput } from "@/lib/schemas/admin";
import { deleteProduct, setProductActive, updateProduct } from "@/lib/services/admin-products";

type Ctx = { params: Promise<{ id: string }> };

export async function PUT(req: Request, { params }: Ctx) {
  const denied = await requireAdminApi(req);
  if (denied) return denied;
  const body = await parseBody(req, productInput);
  if ("error" in body) return body.error;
  try {
    const product = await updateProduct((await params).id, body.data);
    return NextResponse.json({ id: product.id, slug: product.slug });
  } catch (e) {
    return handleError(e);
  }
}

/** Activar / desactivar (no elimina nada). */
export async function PATCH(req: Request, { params }: Ctx) {
  const denied = await requireAdminApi(req);
  if (denied) return denied;
  const body = await parseBody(req, toggleActiveInput);
  if ("error" in body) return body.error;
  try {
    await setProductActive((await params).id, body.data.active);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return handleError(e);
  }
}

export async function DELETE(req: Request, { params }: Ctx) {
  const denied = await requireAdminApi(req);
  if (denied) return denied;
  try {
    await deleteProduct((await params).id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return handleError(e);
  }
}
