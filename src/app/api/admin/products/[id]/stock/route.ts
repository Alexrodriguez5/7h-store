import { NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/admin/guard";
import { handleError, parseBody } from "@/lib/admin/http";
import { stockInput } from "@/lib/schemas/admin";
import { setStock } from "@/lib/services/admin-products";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const denied = await requireAdminApi(req);
  if (denied) return denied;
  const body = await parseBody(req, stockInput);
  if ("error" in body) return body.error;
  try {
    const p = await setStock((await params).id, body.data);
    return NextResponse.json({ ok: true, stock: p.stock });
  } catch (e) {
    return handleError(e);
  }
}
