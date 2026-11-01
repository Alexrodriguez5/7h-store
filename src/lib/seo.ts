/**
 * URL pública del sitio sin barra final. Orden: NEXT_PUBLIC_SITE_URL; en Vercel, el dominio de
 * producción del proyecto (VERCEL_PROJECT_PRODUCTION_URL, lo define Vercel); si no, localhost.
 */
export const siteUrl = () => {
  const explicit = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  const vercel = process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim();
  const base = explicit && !(vercel && explicit.includes("localhost")) ? explicit : vercel ? `https://${vercel}` : "http://localhost:3000";
  return base.replace(/\/+$/, "");
};

const BACKSLASH = String.fromCharCode(92);

/**
 * Serializa datos estructurados para <script type="application/ld+json">.
 * Convierte "<", ">" y "&" en secuencias unicode de JSON (barra invertida + u + código),
 * para que un texto con "</script>" no pueda cerrar la etiqueta (XSS). El JSON resultante es equivalente.
 */
export const jsonLdScript = (data: unknown) =>
  JSON.stringify(data).replace(/[<>&]/g, (c) => `${BACKSLASH}u${c.charCodeAt(0).toString(16).padStart(4, "0")}`);
