import { randomBytes } from "node:crypto";
import { MAX_IMAGE_BYTES, detectImageType } from "@/lib/images";

export const PRODUCT_BUCKET = "product-images";

export class UploadError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

/** Sube una imagen a Supabase Storage (REST, con la service-role key SOLO en servidor). */
export async function uploadProductImage(file: File, fetchImpl: typeof fetch = fetch): Promise<string> {
  const base = process.env.SUPABASE_URL?.replace(/\/$/, "");
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!base || !key) throw new UploadError(503, "El almacenamiento de imágenes no está configurado (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY).");
  if (file.size === 0 || file.size > MAX_IMAGE_BYTES) throw new UploadError(400, "La imagen debe pesar máximo 5 MB.");

  const bytes = new Uint8Array(await file.arrayBuffer());
  const type = detectImageType(bytes);
  if (!type) throw new UploadError(400, "Formato no válido. Usa JPG, PNG o WebP.");

  const path = `${new Date().getFullYear()}/${randomBytes(12).toString("hex")}.${type.ext}`;
  const res = await fetchImpl(`${base}/storage/v1/object/${PRODUCT_BUCKET}/${path}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, apikey: key, "Content-Type": type.mime, "x-upsert": "false" },
    body: bytes as unknown as BodyInit,
  });
  if (!res.ok) throw new UploadError(502, "No se pudo guardar la imagen en el almacenamiento.");
  return `${base}/storage/v1/object/public/${PRODUCT_BUCKET}/${path}`;
}
