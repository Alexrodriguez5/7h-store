import type { Product } from "@/types";

const APPAREL_ORDER = ["XXS", "XS", "S", "M", "L", "XL", "XXL", "XXXL"];

/** Ordena tallas: numéricas de menor a mayor, de ropa por escala, el resto alfabético. */
export function sortSizes(sizes: string[]): string[] {
  const rank = (s: string) => APPAREL_ORDER.indexOf(s.toUpperCase());
  return [...sizes].sort((a, b) => {
    const na = Number(a);
    const nb = Number(b);
    if (!Number.isNaN(na) && !Number.isNaN(nb)) return na - nb;
    const ra = rank(a);
    const rb = rank(b);
    if (ra >= 0 && rb >= 0) return ra - rb;
    if (ra >= 0) return -1;
    if (rb >= 0) return 1;
    return a.localeCompare(b);
  });
}

/** Reparte `total` unidades en `parts` partes enteras (el resto va a las primeras). */
export function splitStock(total: number, parts: number): number[] {
  if (parts <= 0) return [];
  const base = Math.floor(Math.max(0, total) / parts);
  const rest = Math.max(0, total) % parts;
  return Array.from({ length: parts }, (_, i) => base + (i < rest ? 1 : 0));
}

type SizeProduct = Pick<Product, "stock" | "variants">;

/** Stock disponible de una talla (o del producto si no maneja tallas). */
export function stockForSize(product: SizeProduct, size?: string): number {
  if (product.variants?.length) {
    if (!size) return 0;
    return product.variants.find((v) => v.size === size)?.stock ?? 0;
  }
  return product.stock;
}

export const isSizeAvailable = (product: SizeProduct, size: string) => stockForSize(product, size) > 0;

export function totalStock(variants: { stock: number }[] | undefined, fallback: number): number {
  return variants?.length ? variants.reduce((n, v) => n + v.stock, 0) : fallback;
}

/** Validación de tallas según categoría (ropa: S/M/L… o numérica; calzado: 20–52). */
export function isValidSize(category: string, size: string): boolean {
  const s = size.trim().toUpperCase();
  if (!s || s.length > 10) return false;
  if (category === "calzado") {
    const n = Number(s);
    return Number.isFinite(n) && n >= 20 && n <= 52 && (n * 2) % 1 === 0;
  }
  if (category === "ropa") {
    if (APPAREL_ORDER.includes(s) || s === "UNICA" || s === "ÚNICA") return true;
    const n = Number(s);
    return Number.isInteger(n) && n >= 2 && n <= 60;
  }
  return /^[A-Z0-9][A-Z0-9 .\-]{0,9}$/.test(s);
}
