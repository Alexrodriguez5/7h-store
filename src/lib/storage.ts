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

/** Ruta interna de un archivo SUBIDO por esta tienda (año/hex24.ext). Cualquier otra URL se ignora. */
export function ownStoragePath(url: string): string | null {
  const base = process.env.SUPABASE_URL?.replace(/\/$/, "");
  if (!base) return null;
  const prefix = `${base}/storage/v1/object/public/${PRODUCT_BUCKET}/`;
  if (!url.startsWith(prefix)) return null;
  const path = url.slice(prefix.length);
  return /^\d{4}\/[a-f0-9]{24}\.(jpg|png|webp)$/.test(path) ? path : null;
}

/**
 * Borra del bucket imágenes que ya no usa ningún producto ni categoría.
 * Es "mejor esfuerzo": si falla, la imagen queda huérfana pero nada se rompe.
 */
export async function deleteUnusedImages(
  urls: string[],
  isInUse: (url: string) => Promise<boolean>,
  fetchImpl: typeof fetch = fetch,
): Promise<number> {
  const base = process.env.SUPABASE_URL?.replace(/\/$/, "");
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!base || !key || urls.length === 0) return 0;
  const paths: string[] = [];
  for (const url of new Set(urls)) {
    const path = ownStoragePath(url);
    if (path && !(await isInUse(url))) paths.push(path);
  }
  if (paths.length === 0) return 0;
  try {
    const res = await fetchImpl(`${base}/storage/v1/object/${PRODUCT_BUCKET}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${key}`, apikey: key, "Content-Type": "application/json" },
      body: JSON.stringify({ prefixes: paths }),
    });
    if (!res.ok) console.error("[storage] no se pudieron borrar imágenes:", res.status);
    return res.ok ? paths.length : 0;
  } catch (e) {
    console.error("[storage] error al borrar imágenes:", e instanceof Error ? e.message : e);
    return 0;
  }
}
