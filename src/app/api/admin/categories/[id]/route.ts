import { NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/admin/guard";
import { handleError, parseBody } from "@/lib/admin/http";
import { categoryInput } from "@/lib/schemas/admin";
import { prisma } from "@/lib/prisma";

/** Solo se edita la etiqueta visible: el slug es parte de las URLs y del menú público. */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const denied = await requireAdminApi(req);
  if (denied) return denied;
  const body = await parseBody(req, categoryInput);
  if ("error" in body) return body.error;
  try {
    const r = await prisma.category.updateMany({ where: { id: (await params).id }, data: { label: body.data.label } });
    if (r.count !== 1) return NextResponse.json({ error: "Categoría no encontrada." }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return handleError(e);
  }
}
