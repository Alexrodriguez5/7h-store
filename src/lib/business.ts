/**
 * Datos comerciales y legales de 7H STORE en UN solo lugar.
 *
 * Los valores vienen de variables de entorno públicas (NEXT_PUBLIC_BUSINESS_*), para cambiarlos en
 * Vercel sin tocar código. Mientras un dato no esté configurado, las páginas muestran
 * "[Pendiente: …]" en vez de inventarlo. NO completes estos datos con información no confirmada.
 */
const env = (v: string | undefined) => (v && v.trim() ? v.trim() : null);

export const BUSINESS = {
  name: "7H STORE",
  slogan: "Calidad. Estilo. Confianza.",
  /** Razón social o nombre del titular del negocio. */
  legalName: env(process.env.NEXT_PUBLIC_BUSINESS_LEGAL_NAME),
  /** NIT o cédula del titular. */
  taxId: env(process.env.NEXT_PUBLIC_BUSINESS_TAX_ID),
  city: env(process.env.NEXT_PUBLIC_BUSINESS_CITY),
  address: env(process.env.NEXT_PUBLIC_BUSINESS_ADDRESS),
  email: env(process.env.NEXT_PUBLIC_BUSINESS_EMAIL),
  /** WhatsApp en formato internacional sin "+" ni espacios, p. ej. 573001234567. */
  whatsapp: env(process.env.NEXT_PUBLIC_BUSINESS_WHATSAPP),
  /** Plazo de entrega en texto, p. ej. "3 a 7 días hábiles". */
  shippingTime: env(process.env.NEXT_PUBLIC_SHIPPING_TIME),
  /** Fecha de última actualización de los textos legales, p. ej. "1 de noviembre de 2026". */
  legalUpdated: env(process.env.NEXT_PUBLIC_LEGAL_UPDATED),
  instagram: { handle: "@store.h7_", url: "https://www.instagram.com/store.h7_/" },
} as const;

/** Muestra el dato o un marcador visible "[Pendiente: …]" (nunca un valor inventado). */
export const orPending = (value: string | null, label: string) => value ?? `[Pendiente: ${label}]`;

export const whatsappUrl = (n: string | null) => (n ? `https://wa.me/${n.replace(/\D/g, "")}` : null);
