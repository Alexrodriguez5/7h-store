import { prisma } from "@/lib/prisma";
import { sortSizes, totalStock } from "@/lib/sizes";
import type { Product, CategorySlug, Gender } from "@/types";

type Row = { id:string; slug:string; name:string; brand:string; description:string; priceCOP:number; compareAtPriceCOP:number|null; gender:string; isAccessory:boolean; images:string[]; sizes:string[]; stock:number; tags:string[]; featured:boolean; category:{slug:string}; variants:{id:string; size:string; stock:number}[] };

/** Con variantes, el stock y las tallas salen de ellas (las agotadas se envían con stock 0 para mostrarlas deshabilitadas). */
export function mapProduct(p: Row): Product {
  const hasVariants = p.variants.length > 0;
  const sizes = hasVariants ? sortSizes(p.variants.map((v) => v.size)) : p.sizes;
  return { id:p.id, slug:p.slug, name:p.name, brand:p.brand, description:p.description, priceCOP:p.priceCOP, compareAtPriceCOP:p.compareAtPriceCOP ?? undefined, category:p.category.slug as CategorySlug, gender:p.gender.toLowerCase() as Gender, isAccessory:p.isAccessory, images:p.images, sizes:sizes.length ? sizes : undefined, variants:hasVariants ? sizes.map((s)=>{ const v=p.variants.find((x)=>x.size===s)!; return {id:v.id,size:v.size,stock:v.stock}; }) : undefined, stock:totalStock(p.variants, p.stock), tags:p.tags, featured:p.featured };
}
const include = { category:true, variants:true } as const;
export async function getProducts(): Promise<Product[]> { const rows = await prisma.product.findMany({ where:{active:true}, include, orderBy:{createdAt:"desc"} }); return rows.map(mapProduct); }
export async function getFeaturedProducts(): Promise<Product[]> { const rows = await prisma.product.findMany({ where:{featured:true, active:true}, include, take:8, orderBy:{createdAt:"desc"} }); return rows.map(mapProduct); }
export async function getProductBySlug(slug:string): Promise<Product|undefined> { const p = await prisma.product.findUnique({ where:{slug}, include }); return p && p.active ? mapProduct(p) : undefined; }
export async function getProductsByCategory(category:CategorySlug, excludeId?:string): Promise<Product[]> { const rows = await prisma.product.findMany({ where:{active:true, category:{slug:category}, ...(excludeId ? {id:{not:excludeId}} : {})}, include, take:4 }); return rows.map(mapProduct); }
