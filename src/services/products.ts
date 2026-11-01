import { unstable_cache } from "next/cache";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { sortSizes, totalStock } from "@/lib/sizes";
import { CATALOG_TTL_SECONDS, TAG_CATEGORIES, TAG_PRODUCTS } from "@/lib/cache";
import type { Category, Gender, Product } from "@/types";

type Row = {
  id: string; slug: string; name: string; brand: string; description: string; priceCOP: number; compareAtPriceCOP: number | null; gender: string;
  isAccessory: boolean; images: string[]; sizes: string[]; stock: number; tags: string[]; featured: boolean; category: { slug: string };
  variants: { id: string; size: string; stock: number }[]; weightGrams?: number | null;
};

/** Con variantes, el stock y las tallas salen de ellas (las agotadas se envían con stock 0 para mostrarlas deshabilitadas). */
export function mapProduct(p: Row): Product {
  const hasVariants = p.variants.length > 0;
  const sizes = hasVariants ? sortSizes(p.variants.map((v) => v.size)) : p.sizes;
  return {
    id: p.id, slug: p.slug, name: p.name, brand: p.brand, description: p.description, priceCOP: p.priceCOP,
    compareAtPriceCOP: p.compareAtPriceCOP ?? undefined, category: p.category.slug, gender: p.gender.toLowerCase() as Gender,
    isAccessory: p.isAccessory, images: p.images, sizes: sizes.length ? sizes : undefined,
    variants: hasVariants ? sizes.map((s) => { const v = p.variants.find((x) => x.size === s)!; return { id: v.id, size: v.size, stock: v.stock }; }) : undefined,
    stock: totalStock(p.variants, p.stock), tags: p.tags, featured: p.featured, weightGrams: p.weightGrams ?? null,
  };
}

/** Solo los campos que usa la tienda (sin fechas ni datos internos). */
const select = {
  id: true, slug: true, name: true, brand: true, description: true, priceCOP: true, compareAtPriceCOP: true, gender: true, isAccessory: true,
  images: true, sizes: true, stock: true, tags: true, featured: true, category: { select: { slug: true } }, variants: { select: { id: true, size: true, stock: true } }, weightGrams: true,
} satisfies Prisma.ProductSelect;

/** Visible en la tienda: producto activo dentro de una categoría activa. */
const visible = { active: true, category: { active: true } } satisfies Prisma.ProductWhereInput;

const cacheOpts = (...tags: string[]) => ({ tags, revalidate: CATALOG_TTL_SECONDS });

/**
 * Datos del catálogo con caché de Next: la base de datos solo se consulta cuando el admin cambia
 * algo, cuando un pedido reserva/libera stock (invalidación por etiqueta) o cada 5 minutos.
 */
export const getProducts = unstable_cache(
  async (): Promise<Product[]> => (await prisma.product.findMany({ where: visible, select, orderBy: { createdAt: "desc" } })).map(mapProduct),
  ["public:products:all"],
  cacheOpts(TAG_PRODUCTS),
);

export const getFeaturedProducts = unstable_cache(
  async (): Promise<Product[]> => (await prisma.product.findMany({ where: { ...visible, featured: true }, select, take: 8, orderBy: { createdAt: "desc" } })).map(mapProduct),
  ["public:products:featured"],
  cacheOpts(TAG_PRODUCTS),
);

export const getProductBySlug = unstable_cache(
  async (slug: string): Promise<Product | null> => {
    const p = await prisma.product.findFirst({ where: { slug, ...visible }, select });
    return p ? mapProduct(p) : null;
  },
  ["public:products:by-slug"],
  cacheOpts(TAG_PRODUCTS),
);

export const getProductsByCategory = unstable_cache(
  async (category: string, excludeId?: string): Promise<Product[]> =>
    (await prisma.product.findMany({ where: { ...visible, category: { slug: category, active: true }, ...(excludeId ? { id: { not: excludeId } } : {}) }, select, take: 4, orderBy: { createdAt: "desc" } })).map(mapProduct),
  ["public:products:by-category"],
  cacheOpts(TAG_PRODUCTS),
);

/** Categorías visibles en la tienda (menú, pie de página, portada y filtros). */
export const getActiveCategories = unstable_cache(
  async (): Promise<Category[]> =>
    prisma.category.findMany({ where: { active: true }, select: { slug: true, label: true, imageUrl: true }, orderBy: [{ sortOrder: "asc" }, { label: "asc" }] }),
  ["public:categories:active"],
  cacheOpts(TAG_CATEGORIES),
);
