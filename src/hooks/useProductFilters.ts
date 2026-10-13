"use client";
import { useCallback, useMemo } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { applyFilters } from "@/lib/filters";
import {
  DEFAULT_FILTERS,
  type FilterState,
  type Gender,
  type Product,
  type SortOption,
} from "@/types";

const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const G: readonly Gender[] = ["hombre", "mujer", "unisex"];
const S: readonly SortOption[] = ["relevancia", "precio-asc", "precio-desc", "novedades"];
/**
 * Lee los filtros de la URL. Las categorías válidas vienen de la base de datos (`allowedCategories`);
 * sin lista, se acepta cualquier slug con formato válido.
 */
export function parseFilters(
  params: { get: (name: string) => string | null },
  allowedCategories?: readonly string[],
): FilterState {
  const c = params.get("categoria"),
    g = params.get("genero"),
    s = params.get("orden"),
    m = params.get("max");
  const max = m ? Number(m) : null;
  return {
    search: params.get("q") ?? DEFAULT_FILTERS.search,
    category:
      c && SLUG_RE.test(c) && (!allowedCategories || allowedCategories.includes(c)) ? c : "todo",
    gender: g && G.includes(g as Gender) ? (g as Gender) : "todos",
    onlyAccessories: params.get("accesorios") === "1",
    maxPriceCOP: max !== null && Number.isInteger(max) && max >= 0 ? max : null,
    sort: s && S.includes(s as SortOption) ? (s as SortOption) : "relevancia",
  };
}
export function serializeFilters(f: FilterState) {
  const p = new URLSearchParams();
  if (f.search.trim()) p.set("q", f.search.trim());
  if (f.category !== "todo") p.set("categoria", f.category);
  if (f.gender !== "todos") p.set("genero", f.gender);
  if (f.onlyAccessories) p.set("accesorios", "1");
  if (f.maxPriceCOP !== null) p.set("max", String(f.maxPriceCOP));
  if (f.sort !== "relevancia") p.set("orden", f.sort);
  return p.toString();
}
export function useProductFilters(products: Product[], categorySlugs?: readonly string[]) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const filters = useMemo(() => parseFilters(sp, categorySlugs), [sp, categorySlugs]);
  const visible = useMemo(() => applyFilters(products, filters), [products, filters]);
  const update = useCallback(
    <K extends keyof FilterState>(key: K, value: FilterState[K]) => {
      const q = serializeFilters({ ...filters, [key]: value });
      router.replace(`${pathname}${q ? `?${q}` : ""}`, { scroll: false });
    },
    [filters, pathname, router],
  );
  const reset = useCallback(() => router.replace(pathname, { scroll: false }), [pathname, router]);
  return { filters, visible, update, reset };
}
