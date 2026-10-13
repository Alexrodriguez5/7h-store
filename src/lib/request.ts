/**
 * IP del cliente para límites de intentos y auditoría.
 * En Vercel/Netlify/Cloudflare el proxy reescribe estas cabeceras. Si publicas la tienda
 * detrás de un servidor propio, configura el proxy para que sobrescriba X-Forwarded-For.
 */
export function getClientIp(req: Request): string {
  const real = req.headers.get("x-real-ip")?.trim();
  if (real) return real.slice(0, 64);
  const fwd = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return (fwd || "unknown").slice(0, 64);
}

export const getUserAgent = (req: Request) => (req.headers.get("user-agent") ?? "").slice(0, 200) || null;

/** Lee el cuerpo JSON sin lanzar: devuelve undefined si no es JSON válido. */
export const readJson = (req: Request): Promise<unknown> => req.json().catch(() => undefined);

/**
 * Defensa CSRF complementaria a SameSite=Strict: la petición debe venir de este mismo sitio.
 * Acepta el Host directo, el host reenviado por un túnel/proxy (X-Forwarded-Host) y el dominio público configurado.
 */
export function isSameOrigin(req: Request): boolean {
  const origin = req.headers.get("origin");
  if (!origin) return req.headers.get("sec-fetch-site") === "same-origin";
  let originHost: string;
  try { originHost = new URL(origin).host; } catch { return false; }
  const allowed = new Set<string>();
  const host = req.headers.get("host");
  if (host) allowed.add(host);
  const fwd = req.headers.get("x-forwarded-host")?.split(",")[0]?.trim();
  if (fwd) allowed.add(fwd);
  try { if (process.env.NEXT_PUBLIC_SITE_URL) allowed.add(new URL(process.env.NEXT_PUBLIC_SITE_URL).host); } catch { /* URL mal configurada: se ignora */ }
  return allowed.has(originHost);
}
