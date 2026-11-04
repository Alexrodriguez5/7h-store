/**
 * Auditoría de calidad comercial de un producto (para el panel).
 * NO cambia nada: solo avisa al equipo qué falta o qué conviene verificar antes de vender.
 * Ningún precio, descuento ni dato se modifica automáticamente.
 */
export interface QualityInput {
  name: string;
  description: string;
  priceCOP: number;
  compareAtPriceCOP: number | null;
  images: string[];
  categoryLabel: string;
  hasSizes: boolean;
}

export interface QualityIssue { level: "alta" | "media"; text: string }

/** Frases que aparecen en descripciones genéricas (no describen el producto en sí). */
const GENERIC = [/producto original/i, /selecci[oó]n 7h/i, /impuestos incluidos/i, /env[ií]o a toda colombia/i];

export function productIssues(p: QualityInput, categoryMedianCOP?: number): QualityIssue[] {
  const out: QualityIssue[] = [];
  const desc = p.description.trim();
  // Quitando las frases genéricas, ¿queda información real del producto?
  const specific = GENERIC.reduce((s, re) => s.replace(re, ""), desc).replace(/[.,·\s]+/g, " ").trim();
  if (desc.length < 120 || specific.length < 80) {
    out.push({ level: "alta", text: "Descripción genérica o corta: agrega modelo exacto, características, materiales y qué incluye (Ley 1480, art. 50 b)." });
  }
  if (p.images.length < 2) out.push({ level: "media", text: "Solo tiene 1 foto: agrega más fotos reales del producto." });
  if (p.compareAtPriceCOP && p.compareAtPriceCOP > p.priceCOP) {
    const off = Math.round((1 - p.priceCOP / p.compareAtPriceCOP) * 100);
    if (off >= 40) out.push({ level: "alta", text: `Descuento de ${off}%: confirma que el precio anterior fue real (la SIC sanciona descuentos ficticios).` });
  }
  if (categoryMedianCOP && p.priceCOP < categoryMedianCOP * 0.3) {
    out.push({ level: "alta", text: "Precio muy por debajo de su categoría: verifica referencia, proveedor, costo de importación y margen." });
  }
  return out;
}

export function median(values: number[]) {
  if (!values.length) return 0;
  const s = [...values].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}
