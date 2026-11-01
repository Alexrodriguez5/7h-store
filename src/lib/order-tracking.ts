/**
 * Reglas compartidas del rastreo de pedidos (cliente y servidor).
 * Formato del número: 7H-XXXXXX (nuevo) o 7H-AAAA-XXXXXXXX (pedidos anteriores). Ver newOrderCode en lib/services/orders.ts.
 */
/** Formato nuevo 7H-XXXXXX y formato anterior 7H-AAAA-XXXXXXXX (pedidos ya creados). */
export const ORDER_CODE_RE = /^7H-(?:[2-9A-HJKMNP-TW-Z]{6}|\d{4}-[0-9A-F]{8})$/;

/** Mayúsculas, sin espacios y con guiones normalizados ("7h 2026 ab12cd34" → "7H-2026-AB12CD34"). */
export function normalizeOrderCode(raw: string): string {
  const compact = raw.toUpperCase().replace(/[\s_–—]+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
  const flat = compact.replace(/-/g, "");
  const old = flat.match(/^7H(\d{4})([0-9A-F]{8})$/);
  if (old) return `7H-${old[1]}-${old[2]}`;
  const short = flat.match(/^7H([0-9A-Z]{6})$/);
  return short ? `7H-${short[1]}` : compact;
}

export const normalizeEmail = (raw: string) => raw.trim().toLowerCase();

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export type TrackingField = "code" | "email";

/** Validación del formulario; devuelve errores por campo (vacío = todo bien). */
export function validateTracking(code: string, email: string): Partial<Record<TrackingField, string>> {
  const errors: Partial<Record<TrackingField, string>> = {};
  const c = normalizeOrderCode(code);
  if (!c) errors.code = "Escribe tu número de pedido.";
  else if (!ORDER_CODE_RE.test(c)) errors.code = "El número tiene este formato: 7H-K4M9QX.";
  const e = normalizeEmail(email);
  if (!e) errors.email = "Escribe el correo que usaste en la compra.";
  else if (!EMAIL_RE.test(e) || e.length > 254) errors.email = "Revisa el correo: parece incompleto.";
  return errors;
}

/** Etapas visibles del seguimiento. Un pedido cancelado o vencido no avanza en la línea de tiempo. */
export const TRACKING_STEPS = [
  { key: "received", label: "Pedido recibido", hint: "Registramos tu compra." },
  { key: "paid", label: "Pago confirmado", hint: "Recibimos tu pago." },
  { key: "processing", label: "Preparando pedido", hint: "Alistamos y empacamos tus productos." },
  { key: "shipped", label: "Pedido enviado", hint: "Va en camino con la transportadora." },
  { key: "delivered", label: "Pedido entregado", hint: "¡Disfrútalo!" },
] as const;

const STATUS_STEP: Record<string, number> = { pending_payment: 0, paid: 1, processing: 2, shipped: 3, delivered: 4 };

/** Índice de la última etapa COMPLETADA según el estado real (−1 si fue cancelado o venció). */
export const completedStep = (status: string) => (status in STATUS_STEP ? STATUS_STEP[status] : -1);
