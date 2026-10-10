import { NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/admin/guard";
import { UploadError, uploadProductImage } from "@/lib/storage";

export async function POST(req: Request) {
  const denied = await requireAdminApi(req);
  if (denied) return denied;
  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "Adjunta una imagen." }, { status: 400 });
  try {
    return NextResponse.json({ url: await uploadProductImage(file) }, { status: 201 });
  } catch (e) {
    if (e instanceof UploadError) return NextResponse.json({ error: e.message }, { status: e.status });
    return NextResponse.json({ error: "No se pudo subir la imagen." }, { status: 500 });
  }
}
