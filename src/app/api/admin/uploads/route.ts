import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin/guard";
import { audit } from "@/lib/admin/audit";
import { MAX_IMAGE_BYTES } from "@/lib/images";
import { UploadError, uploadProductImage } from "@/lib/storage";
import { MIN, consume, tooMany } from "@/lib/rate-limit";

export async function POST(req: Request) {
  const { ctx, error } = await requireAdmin(req);
  if (error) return error;
  // Corta antes de leer el cuerpo si el tamaño declarado es absurdo.
  const declared = Number(req.headers.get("content-length") ?? 0);
  if (declared > MAX_IMAGE_BYTES + 64 * 1024) return NextResponse.json({ error: "La imagen debe pesar máximo 5 MB." }, { status: 413 });
  const limit = await consume(`upload:${ctx.admin.id}`, 60, 10 * MIN);
  if (!limit.allowed) return tooMany(limit.retryAfterSec, "Demasiadas subidas seguidas. Espera unos minutos.");
  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "Adjunta una imagen." }, { status: 400 });
  try {
    const url = await uploadProductImage(file);
    await audit({ action: "upload.image", adminId: ctx.admin.id, actorEmail: ctx.admin.email, entityType: "image", details: { url }, ip: ctx.ip });
    return NextResponse.json({ url }, { status: 201 });
  } catch (e) {
    if (e instanceof UploadError) return NextResponse.json({ error: e.message }, { status: e.status });
    console.error("[upload] error:", e instanceof Error ? e.message : e);
    return NextResponse.json({ error: "No se pudo subir la imagen." }, { status: 500 });
  }
}
