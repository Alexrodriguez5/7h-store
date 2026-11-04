/**
 * Etiquetas visuales de producto.
 *
 * Regla: ninguna etiqueta se muestra "porque sí".
 * - Las AUTOMÁTICAS salen de datos reales (inventario, precio anterior, fecha de publicación).
 * - Las MANUALES solo aparecen si el administrador las marcó en el panel (él confirma que son ciertas).
 * Las condiciones de toda la tienda (envío nacional, compra segura) no son etiquetas del producto:
 * se informan una sola vez en la ficha.
 */
export const MANUAL_BADGES = {
  ORIGINAL: { label: "Producto original", hint: "Confirmas que es original de la marca." },
  IMPORTADO_USA: { label: "Importado de EE.UU.", hint: "Confirmas que se trae de Estados Unidos." },
  GARANTIA_FABRICANTE: { label: "Garantía del fabricante", hint: "Tiene garantía del fabricante además de la legal." },
  EDICION_LIMITADA: { label: "Edición limitada", hint: "La marca lo presenta como edición limitada." },
} as const;

export type ManualBadge = keyof typeof MANUAL_BADGES;
export const MANUAL_BADGE_KEYS = Object.keys(MANUAL_BADGES) as ManualBadge[];

export type BadgeTone = "gold" | "ink" | "success" | "warning" | "muted";
export interface Badge { key: string; label: string; tone: BadgeTone }

/** Días que un producto se considera "Nuevo" desde que se publica. */
export const NEW_DAYS = 30;
/** Hasta cuántas unidades se avisa "Últimas unidades". */
export const LOW_STOCK = 3;

export interface BadgeSource {
  stock: number;
  priceCOP: number;
  compareAtPriceCOP?: number | null;
  /** ISO de la fecha de publicación. */
  createdAt?: string | null;
  badges?: string[];
}

export function discountPercent(p: Pick<BadgeSource, "priceCOP" | "compareAtPriceCOP">) {
  return p.compareAtPriceCOP && p.compareAtPriceCOP > p.priceCOP ? Math.round((1 - p.priceCOP / p.compareAtPriceCOP) * 100) : 0;
}

/** Etiquetas del producto, en orden de importancia para el comprador. */
export function productBadges(p: BadgeSource, now: Date = new Date()): Badge[] {
  const out: Badge[] = [];
  if (p.stock <= 0) out.push({ key: "AGOTADO", label: "Agotado", tone: "muted" });
  else if (p.stock <= LOW_STOCK) out.push({ key: "ULTIMAS", label: "Últimas unidades", tone: "warning" });

  const off = discountPercent(p);
  if (off > 0 && p.stock > 0) out.push({ key: "OFERTA", label: `Oferta -${off}%`, tone: "gold" });

  if (p.createdAt) {
    const age = now.getTime() - new Date(p.createdAt).getTime();
    if (age >= 0 && age < NEW_DAYS * 86_400_000) out.push({ key: "NUEVO", label: "Nuevo", tone: "ink" });
  }

  for (const key of p.badges ?? []) {
    if (key in MANUAL_BADGES) out.push({ key, label: MANUAL_BADGES[key as ManualBadge].label, tone: "ink" });
  }
  return out;
}

export const BADGE_TONE_CLS: Record<BadgeTone, string> = {
  gold: "bg-gold text-ink",
  ink: "bg-ink/85 text-gold-light backdrop-blur",
  success: "bg-success text-ivory",
  warning: "bg-ivory/95 text-ink ring-1 ring-warning/40 backdrop-blur",
  muted: "bg-ink/80 text-ivory backdrop-blur",
};
