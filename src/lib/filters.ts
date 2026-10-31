import type { FilterState, Product } from "@/types";

/** Minúsculas y sin tildes: "Tecnología" y "tecnologia" se consideran iguales al buscar. */
export const normalize = (s: string) => s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();

/** Función pura: fácil de testear y reutilizable en servidor o cliente. */
export function applyFilters(products: Product[], f: FilterState): Product[] {
  // Cada palabra de la búsqueda debe aparecer (en cualquier orden) en nombre, marca, etiquetas, categoría o descripción.
  const words = normalize(f.search.trim()).split(/\s+/).filter(Boolean);

  const result = products.filter((p) => {
    if (f.category !== "todo" && p.category !== f.category) return false;
    // "unisex" aparece tanto en hombre como en mujer
    if (f.gender !== "todos" && p.gender !== f.gender && p.gender !== "unisex") return false;
    if (f.onlyAccessories && !p.isAccessory) return false;
    if (f.maxPriceCOP !== null && p.priceCOP > f.maxPriceCOP) return false;
    if (words.length) {
      const haystack = normalize(`${p.name} ${p.brand} ${p.tags.join(" ")} ${p.category} ${p.description}`);
      if (!words.every((w) => haystack.includes(w))) return false;
    }
    return true;
  });

  // Los productos llegan ordenados del más nuevo al más antiguo (createdAt desc); los sort son estables.
  if (f.sort === "precio-asc") result.sort((a, b) => a.priceCOP - b.priceCOP);
  if (f.sort === "precio-desc") result.sort((a, b) => b.priceCOP - a.priceCOP);
  // Relevancia: primero los destacados y los que tienen stock; dentro de cada grupo, los más nuevos.
  if (f.sort === "relevancia")
    result.sort((a, b) => (b.featured ? 1 : 0) - (a.featured ? 1 : 0) || (b.stock > 0 ? 1 : 0) - (a.stock > 0 ? 1 : 0));
  // "novedades" conserva el orden de llegada (más nuevos primero).
  return result;
}
