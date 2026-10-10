/** Hosts de imágenes aceptados (deben coincidir con `images.remotePatterns` de next.config.ts). */
export function allowedImageHosts(): string[] {
  const hosts = ["images.unsplash.com", "plus.unsplash.com"];
  const supa = process.env.SUPABASE_URL;
  if (supa) {
    try { hosts.push(new URL(supa).hostname); } catch { /* URL inválida: se ignora */ }
  }
  return hosts;
}

export function isAllowedImageUrl(value: string): boolean {
  try {
    const u = new URL(value);
    return u.protocol === "https:" && allowedImageHosts().includes(u.hostname);
  } catch {
    return false;
  }
}

const SIGNATURES: { mime: string; ext: string; test: (b: Uint8Array) => boolean }[] = [
  { mime: "image/jpeg", ext: "jpg", test: (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  { mime: "image/png", ext: "png", test: (b) => b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47 },
  { mime: "image/webp", ext: "webp", test: (b) => b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 && b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50 },
];

/** Detecta el tipo REAL por los primeros bytes (no confía en el nombre ni en el Content-Type del cliente). */
export function detectImageType(bytes: Uint8Array): { mime: string; ext: string } | null {
  const hit = SIGNATURES.find((s) => s.test(bytes));
  return hit ? { mime: hit.mime, ext: hit.ext } : null;
}

export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
