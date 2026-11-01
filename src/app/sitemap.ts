import type { MetadataRoute } from "next";
import { getActiveCategories, getProducts } from "@/services/products";
import { siteUrl } from "@/lib/seo";

/** Incluye páginas fijas, categorías y productos visibles (datos desde la caché del catálogo). */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = siteUrl();
  const now = new Date();
  const fixed = ["", "/catalogo", "/pedidos", "/envios", "/devoluciones", "/como-comprar", "/contacto", "/terminos", "/privacidad"].map((path) => ({
    url: `${base}${path}`,
    lastModified: now,
  }));
  try {
    const [categories, products] = await Promise.all([getActiveCategories(), getProducts()]);
    return [
      ...fixed,
      ...categories.map((c) => ({ url: `${base}/catalogo?categoria=${encodeURIComponent(c.slug)}`, lastModified: now })),
      ...products.map((p) => ({ url: `${base}/producto/${p.slug}`, lastModified: now })),
    ];
  } catch {
    return fixed;
  }
}
