import { randomBytes } from "node:crypto";
import { detectImageType, MAX_IMAGE_BYTES } from "@/lib/images";

/**
 * Contenido de clientes (fotos de reseñas, solicitudes, galería y comunidad).
 *
 * - Se guarda en un bucket PRIVADO de Supabase Storage: nada es público por subirlo.
 * - La tienda lo sirve por /media/... solo cuando está aprobado (o al administrador).
 * - La clave de servicio se usa SOLO en el servidor.
 */
export const UGC_BUCKET = "contenido-clientes";
export const MAX_UGC_PHOTOS = 4;

export class UgcError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

function storageEnv() {
  const base = process.env.SUPABASE_URL?.replace(/\/$/, "");
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!base || !key) throw new UgcError(503, "El almacenamiento de fotos no está configurado.");
  return { base, key, headers: { Authorization: `Bearer ${key}`, apikey: key } };
}

/**
 * Quita los metadatos EXIF (APP1) de un JPEG: pueden traer la ubicación GPS de la casa del cliente.
 * El navegador ya re-comprime la foto (sin EXIF); esto protege también si alguien sube el archivo original.
 */
export function stripJpegMetadata(bytes: Uint8Array): Uint8Array {
  if (bytes[0] !== 0xff || bytes[1] !== 0xd8) return bytes;
  const out: number[] = [0xff, 0xd8];
  let i = 2;
  while (i + 4 <= bytes.length) {
    if (bytes[i] !== 0xff) break;
    const marker = bytes[i + 1];
    // Inicio de los datos de imagen: el resto se copia tal cual.
    if (marker === 0xda) break;
    const len = (bytes[i + 2] << 8) | bytes[i + 3];
    if (len < 2 || i + 2 + len > bytes.length) break;
    const isExif = marker === 0xe1;
    if (!isExif) for (let j = i; j < i + 2 + len; j++) out.push(bytes[j]);
    i += 2 + len;
  }
  const rest = bytes.subarray(i);
  const merged = new Uint8Array(out.length + rest.length);
  merged.set(out, 0);
  merged.set(rest, out.length);
  return merged;
}

/** Valida una foto por sus bytes reales (JPG, PNG o WebP; nunca SVG/HTML) y su tamaño. */
export function validatePhoto(bytes: Uint8Array) {
  if (bytes.length === 0) throw new UgcError(400, "La foto está vacía.");
  if (bytes.length > MAX_IMAGE_BYTES) throw new UgcError(400, "Cada foto debe pesar máximo 5 MB.");
  const type = detectImageType(bytes);
  if (!type) throw new UgcError(400, "Formato no válido. Usa fotos JPG, PNG o WebP.");
  return type;
}

let bucketReady = false;

async function ensureBucket(fetchImpl: typeof fetch) {
  if (bucketReady) return;
  const { base, headers } = storageEnv();
  const res = await fetchImpl(`${base}/storage/v1/bucket`, {
    method: "POST",
    headers: { ...headers, "Content-Type": "application/json" },
    body: JSON.stringify({ id: UGC_BUCKET, name: UGC_BUCKET, public: false, file_size_limit: MAX_IMAGE_BYTES, allowed_mime_types: ["image/jpeg", "image/png", "image/webp"] }),
  });
  // 200 = creado; 400/409 = ya existía. Cualquier otra cosa se reporta al subir.
  if (res.ok || res.status === 400 || res.status === 409) bucketReady = true;
}

/** Sube una foto validada al bucket privado. Devuelve la ruta interna (nunca una URL pública). */
export async function uploadUgcPhoto(folder: "resenas" | "solicitudes" | "galeria" | "comunidad", raw: Uint8Array, fetchImpl: typeof fetch = fetch) {
  const type = validatePhoto(raw);
  const bytes = type.mime === "image/jpeg" ? stripJpegMetadata(raw) : raw;
  const { base, headers } = storageEnv();
  await ensureBucket(fetchImpl);
  const path = `${folder}/${new Date().getFullYear()}/${randomBytes(12).toString("hex")}.${type.ext}`;
  const res = await fetchImpl(`${base}/storage/v1/object/${UGC_BUCKET}/${path}`, {
    method: "POST",
    headers: { ...headers, "Content-Type": type.mime, "x-upsert": "false" },
    body: bytes as unknown as BodyInit,
  });
  if (!res.ok) throw new UgcError(502, "No se pudo guardar la foto. Inténtalo de nuevo.");
  return { path, mime: type.mime };
}

/** Ruta válida generada por esta tienda (evita leer otras rutas del bucket). */
export const isUgcPath = (p: string) => /^(resenas|solicitudes|galeria|comunidad)\/\d{4}\/[a-f0-9]{24}\.(jpg|png|webp)$/.test(p);

/** Descarga una foto privada (solo servidor). */
export async function readUgcPhoto(path: string, fetchImpl: typeof fetch = fetch): Promise<Response | null> {
  if (!isUgcPath(path)) return null;
  const { base, headers } = storageEnv();
  const res = await fetchImpl(`${base}/storage/v1/object/authenticated/${UGC_BUCKET}/${path}`, { headers });
  return res.ok ? res : null;
}

/** Borra fotos (al rechazar o eliminar contenido). Mejor esfuerzo: si falla, no rompe nada. */
export async function deleteUgcPhotos(paths: string[], fetchImpl: typeof fetch = fetch) {
  const valid = paths.filter(isUgcPath);
  if (!valid.length) return;
  try {
    const { base, headers } = storageEnv();
    await fetchImpl(`${base}/storage/v1/object/${UGC_BUCKET}`, { method: "DELETE", headers: { ...headers, "Content-Type": "application/json" }, body: JSON.stringify({ prefixes: valid }) });
  } catch (e) {
    console.error("[ugc] no se pudieron borrar fotos:", e instanceof Error ? e.message : e);
  }
}

// ── Texto publicado por clientes ──────────────────────────────────────

const LINK_RE = /(https?:\/\/|www\.|\b[a-z0-9-]{2,}\.(com|co|net|org|io|xyz|ly|me|info|biz|app|site|shop|store)\b)/i;
/** Lista corta de insultos frecuentes; lo demás lo filtra la moderación humana. */
const BLOCKED = ["hijueputa", "hpta", "malparido", "gonorrea", "puta", "marica", "pirobo", "careverga", "imbecil", "imbécil", "estupido", "estúpido", "idiota"];

/** Revisa texto de clientes: sin enlaces (spam/phishing) ni insultos. Devuelve el motivo si no pasa. */
export function textProblem(text: string): string | null {
  if (LINK_RE.test(text)) return "Por seguridad no se permiten enlaces en el texto.";
  const words = text.toLowerCase().normalize("NFD").replace(/\p{M}/gu, "").split(/[^a-zñ0-9]+/);
  const blocked = new Set(BLOCKED.map((w) => w.normalize("NFD").replace(/\p{M}/gu, "")));
  if (words.some((w) => blocked.has(w))) return "Tu texto tiene palabras que no se permiten. Escríbelo con respeto, por favor.";
  return null;
}

/** Nombre público seguro: alias del cliente o "Nombre I." (nunca el correo ni el apellido completo). */
export function publicName(alias: string | undefined, fullName: string) {
  const a = alias?.trim().replace(/\s+/g, " ").slice(0, 40);
  if (a && !a.includes("@")) return a;
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (!parts.length || parts[0].includes("@")) return "Cliente 7H";
  return parts.length > 1 ? `${parts[0]} ${parts[1][0].toUpperCase()}.` : parts[0];
}
