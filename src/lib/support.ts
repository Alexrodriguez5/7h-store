/**
 * Solicitudes y garantías (posventa). Reglas compartidas por cliente, panel y correos.
 * Cada tipo tiene su propio trámite y referencia legal (Ley 1480 de 2011). El sistema NUNCA aprueba
 * ni rechaza automáticamente: solo informa plazos de referencia; decide una persona del equipo.
 */
import type { SupportStatus, SupportType } from "@prisma/client";

export interface SupportTypeInfo {
  label: string;
  help: string;
  /** Texto legal de referencia mostrado al cliente y al equipo. */
  legal: string;
  /** Requiere elegir productos del pedido. */
  needsItems: boolean;
  /** Días hábiles orientativos para dar respuesta. */
  responseDays: number;
}

export const SUPPORT_TYPES: Record<SupportType, SupportTypeInfo> = {
  RETRACTO: { label: "Derecho de retracto", help: "Te arrepentiste de la compra (compra a distancia).", legal: "Art. 47 Ley 1480: 5 días hábiles desde la entrega; producto sin uso y en su empaque; el transporte de la devolución corre por cuenta del cliente; reintegro máximo en 30 días calendario.", needsItems: true, responseDays: 5 },
  GARANTIA: { label: "Garantía legal", help: "El producto dejó de funcionar o no cumple su calidad.", legal: "Arts. 7 a 11 Ley 1480 y Decreto 735 de 2013: reparación, cambio o devolución del dinero según el caso.", needsItems: true, responseDays: 15 },
  DEFECTUOSO: { label: "Producto defectuoso", help: "Llegó con un defecto de fábrica.", legal: "Garantía legal (Ley 1480): se revisa el defecto con fotos o video.", needsItems: true, responseDays: 15 },
  DANADO_TRANSPORTE: { label: "Dañado en el transporte", help: "El paquete o el producto llegó golpeado o roto.", legal: "Responsabilidad del vendedor frente al consumidor; se gestiona con la transportadora. Adjunta fotos del empaque y la guía.", needsItems: true, responseDays: 10 },
  DIFERENTE: { label: "Producto diferente", help: "Recibiste algo distinto a lo que compraste.", legal: "Derecho a recibir lo pactado (Ley 1480); puede dar lugar a cambio o reversión del pago.", needsItems: true, responseDays: 10 },
  INCOMPLETO: { label: "Producto incompleto", help: "Faltan piezas, accesorios o unidades.", legal: "Derecho a recibir lo pactado (Ley 1480).", needsItems: true, responseDays: 10 },
  NO_RECIBIDO: { label: "Producto no recibido", help: "El pedido no te ha llegado.", legal: "Si pagaste con medios electrónicos puedes pedir reversión del pago (art. 51 Ley 1480). Revisamos el estado con la transportadora.", needsItems: false, responseDays: 5 },
  CANCELACION: { label: "Cancelación", help: "Quieres cancelar un pedido que aún no se ha enviado.", legal: "Se revisa el estado del pedido; si ya se pagó, se gestiona la devolución del dinero.", needsItems: false, responseDays: 3 },
  REVERSION_PAGO: { label: "Reversión del pago", help: "Fraude, operación no solicitada, producto no recibido, distinto o defectuoso, pagado con medios electrónicos.", legal: "Art. 51 Ley 1480 y Decreto 587 de 2016: solicitarla dentro de 5 días hábiles desde que conociste la causal; también debes informarla a tu banco o emisor.", needsItems: false, responseDays: 15 },
  CAMBIO_COMERCIAL: { label: "Cambio comercial", help: "Cambio de talla o referencia por gusto (sin defecto).", legal: "No es un derecho legal: depende de la política comercial y la disponibilidad.", needsItems: true, responseDays: 10 },
  OTRO: { label: "Otro requerimiento", help: "Cualquier otra petición, queja o reclamo.", legal: "PQR: respuesta en máximo 15 días hábiles.", needsItems: false, responseDays: 15 },
};

export const SUPPORT_STATUS: Record<SupportStatus, { label: string; tone: "neutral" | "gold" | "success" | "error" | "warning"; final?: boolean }> = {
  RECIBIDA: { label: "Recibida", tone: "neutral" },
  EN_REVISION: { label: "En revisión", tone: "gold" },
  INFO_SOLICITADA: { label: "Información adicional solicitada", tone: "warning" },
  APROBADA: { label: "Aprobada", tone: "success" },
  NO_APROBADA: { label: "No aprobada", tone: "error", final: true },
  ESPERANDO_DEVOLUCION: { label: "Esperando devolución del producto", tone: "warning" },
  PRODUCTO_RECIBIDO: { label: "Producto recibido", tone: "gold" },
  SOLUCION_EN_PROCESO: { label: "Solución en proceso", tone: "gold" },
  REEMBOLSO_EN_PROCESO: { label: "Reembolso en proceso", tone: "gold" },
  FINALIZADA: { label: "Finalizada", tone: "success", final: true },
};

export const SUPPORT_STATUS_ORDER = Object.keys(SUPPORT_STATUS) as SupportStatus[];

/** Suma días hábiles (lunes a viernes; no considera festivos: es una fecha orientativa). */
export function addBusinessDays(from: Date, days: number): Date {
  const d = new Date(from);
  let left = days;
  while (left > 0) {
    d.setDate(d.getDate() + 1);
    const wd = d.getDay();
    if (wd !== 0 && wd !== 6) left--;
  }
  return d;
}

export const supportCode = (year: number, n: number) => `SOL-${year}-${String(n).padStart(6, "0")}`;

// ── Evidencias ────────────────────────────────────────────────────────

/** Vercel limita el cuerpo de cada petición a ~4,5 MB: se aceptan hasta 4 MB por envío. */
export const MAX_EVIDENCE_TOTAL = 4 * 1024 * 1024;
export const MAX_EVIDENCE_FILES = 4;

/** Tipo real por los primeros bytes (no se confía en el nombre ni en el navegador). Solo fotos y video MP4/WebM/MOV. */
export function detectEvidenceType(b: Uint8Array): { mime: string; ext: string } | null {
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return { mime: "image/jpeg", ext: "jpg" };
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return { mime: "image/png", ext: "png" };
  if (b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 && b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50) return { mime: "image/webp", ext: "webp" };
  const ftyp = b[4] === 0x66 && b[5] === 0x74 && b[6] === 0x79 && b[7] === 0x70;
  if (ftyp) {
    const brand = String.fromCharCode(b[8], b[9], b[10], b[11]);
    if (brand.startsWith("qt")) return { mime: "video/quicktime", ext: "mov" };
    if (/^(heic|heix|mif1|msf1)/.test(brand)) return { mime: "image/heic", ext: "heic" };
    return { mime: "video/mp4", ext: "mp4" };
  }
  if (b[0] === 0x1a && b[1] === 0x45 && b[2] === 0xdf && b[3] === 0xa3) return { mime: "video/webm", ext: "webm" };
  return null;
}
