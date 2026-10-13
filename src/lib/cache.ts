import { revalidateTag } from "next/cache";

/**
 * Etiquetas de la caché de datos del catálogo público.
 * Las páginas se renderizan en cada visita, pero los datos salen de la caché de Next
 * (sin consultar la base de datos) hasta que una de estas etiquetas se invalida.
 */
export const TAG_PRODUCTS = "catalog:products";
export const TAG_CATEGORIES = "catalog:categories";
/** Red de seguridad: aunque nadie invalide, los datos se refrescan cada 5 minutos. */
export const CATALOG_TTL_SECONDS = 300;

function safeRevalidate(tag: string) {
  try {
    revalidateTag(tag);
  } catch {
    /* fuera de una petición de Next (p. ej. pruebas o scripts): no hay caché que invalidar */
  }
}

/** Llamar después de cambiar productos, precios, imágenes o stock (incluye reservas y liberaciones de pedidos). */
export const invalidateProducts = () => safeRevalidate(TAG_PRODUCTS);

/** Llamar después de cambiar categorías (también afecta a los productos que muestran su categoría). */
export function invalidateCategories() {
  safeRevalidate(TAG_CATEGORIES);
  safeRevalidate(TAG_PRODUCTS);
}
