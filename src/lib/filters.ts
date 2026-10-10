import type { FilterState, Product } from "@/types";

/** Función pura: fácil de testear y reutilizable en servidor o cliente. */
export function applyFilters(products: Product[], f: FilterState): Product[] {
  const q = f.search.trim().toLowerCase();

  const result = products.filter((p) => {
    if (f.category !== "todo" && p.category !== f.category) return false;
    // "unisex" aparece tanto en hombre como en mujer
    if (f.gender !== "todos" && p.gender !== f.gender && p.gender !== "unisex") return false;
    if (f.onlyAccessories && !p.isAccessory) return false;
    if (f.maxPriceCOP !== null && p.priceCOP > f.maxPriceCOP) return false;
    if (q) {
      const haystack = `${p.name} ${p.brand} ${p.tags.join(" ")}`.toLowerCase();
      if (!haystack.includes(q)) return false;
    }
    return true;
  });

  if (f.sort === "precio-asc") result.sort((a, b) => a.priceCOP - b.priceCOP);
  if (f.sort === "precio-desc") result.sort((a, b) => b.priceCOP - a.priceCOP);
  if (f.sort === "novedades") result.sort((a, b) => (b.featured ? 1 : 0) - (a.featured ? 1 : 0));
  if (f.sort === "novedades") result.sort((a, b) => (b.featured ? 1 : 0) - (a.featured ? 1 : 0));
  if (f.sort === "novedades") result.sort((a, b) => (b.featured ? 1 : 0) - (a.featured ? 1 : 0));
  if (f.sort === "novedades") result.sort((a, b) => (b.featured ? 1 : 0) - (a.featured ? 1 : 0));
  if (f.sort === "novedades") result.sort((a, b) => (b.featured ? 1 : 0) - (a.featured ? 1 : 0));
  return result;
}
