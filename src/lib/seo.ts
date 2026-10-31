/** URL pública del sitio sin barra final (NEXT_PUBLIC_SITE_URL). */
export const siteUrl = () => (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").trim().replace(/\/+$/, "");

const BACKSLASH = String.fromCharCode(92);

/**
 * Serializa datos estructurados para <script type="application/ld+json">.
 * Convierte "<", ">" y "&" en secuencias unicode de JSON (barra invertida + u + código),
 * para que un texto con "</script>" no pueda cerrar la etiqueta (XSS). El JSON resultante es equivalente.
 */
export const jsonLdScript = (data: unknown) =>
  JSON.stringify(data).replace(/[<>&]/g, (c) => `${BACKSLASH}u${c.charCodeAt(0).toString(16).padStart(4, "0")}`);
