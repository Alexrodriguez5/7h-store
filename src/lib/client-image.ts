/**
 * Comprime una foto EN EL NAVEGADOR antes de subirla:
 * - la reduce a máx. 1600 px por lado y la guarda como JPEG (calidad 0.82);
 * - al re-dibujarla se pierden los metadatos EXIF (como la ubicación GPS);
 * - así 4 fotos caben en el límite del servidor y suben rápido en datos móviles.
 */
export async function compressImage(file: File, maxSide = 1600, quality = 0.82): Promise<File> {
  if (!/^image\/(jpeg|png|webp)$/.test(file.type)) throw new Error("Usa fotos JPG, PNG o WebP.");
  const bitmap = await createImageBitmap(file).catch(() => null);
  if (!bitmap) throw new Error("No pudimos leer esa foto. Prueba con otra.");
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const w = Math.round(bitmap.width * scale);
  const h = Math.round(bitmap.height * scale);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Tu navegador no pudo procesar la foto.");
  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close?.();
  const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/jpeg", quality));
  if (!blob) throw new Error("No pudimos procesar la foto.");
  return new File([blob], file.name.replace(/\.\w+$/, "") + ".jpg", { type: "image/jpeg" });
}

/** Total máximo que acepta el servidor por envío (fotos ya comprimidas). */
export const MAX_UPLOAD_TOTAL = 4 * 1024 * 1024;
