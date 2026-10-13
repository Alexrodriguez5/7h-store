import type { NextConfig } from "next";

const isProd = process.env.NODE_ENV === "production";
const supabaseHost = (() => { try { return process.env.SUPABASE_URL ? new URL(process.env.SUPABASE_URL).hostname : null; } catch { return null; } })();

/**
 * Content-Security-Policy. Next.js inyecta scripts en línea para hidratar la página, por eso
 * script-src necesita 'unsafe-inline' (sin nonces). Aun así la política bloquea scripts de otros
 * dominios, <object>, que la tienda se muestre dentro de iframes ajenos y envíos de formularios a terceros.
 * El pago con Wompi es una REDIRECCIÓN (no un iframe), así que no requiere excepciones.
 */
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isProd ? "" : " 'unsafe-eval'"}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data:",
  `connect-src 'self'${isProd ? "" : " ws: wss:"}`,
  // En desarrollo se permite el mismo origen (vistas previas del editor); en producción nadie puede incrustar la tienda.
  isProd ? "frame-ancestors 'none'" : "frame-ancestors 'self'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
].join("; ");

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "images.unsplash.com" },
      { protocol: "https", hostname: "plus.unsplash.com" },
      ...(supabaseHost ? [{ protocol: "https" as const, hostname: supabaseHost }] : [])
    ]
  },
  poweredByHeader: false,
  async headers() {
    return [
      { source: "/(.*)", headers: [
        { key: "Content-Security-Policy", value: csp },
        { key: "X-Content-Type-Options", value: "nosniff" },
        { key: "X-Frame-Options", value: isProd ? "DENY" : "SAMEORIGIN" },
        { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
        // HSTS solo en producción (con HTTPS). Activa "preload" únicamente cuando el dominio esté estable.
        ...(isProd ? [{ key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" }] : [])
      ] },
      // Respuestas del panel y de la API: nunca en cachés intermedias.
      { source: "/api/:path*", headers: [{ key: "Cache-Control", value: "no-store" }] },
      { source: "/admin/:path*", headers: [{ key: "Cache-Control", value: "no-store" }] }
    ];
  }
};
export default nextConfig;
