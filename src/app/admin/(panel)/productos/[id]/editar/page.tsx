import { notFound } from "next/navigation";
import { requireAdminPage } from "@/lib/admin/guard";
import { prisma } from "@/lib/prisma";
import { sortSizes } from "@/lib/sizes";
import { ProductForm, type ProductFormValues } from "@/components/admin/ProductForm";
import { PageHeader } from "@/components/admin/ui";

export const metadata = { title: "Editar producto" };

export default async function EditProductPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdminPage();
  const p = await prisma.product.findUnique({ where: { id: (await params).id }, include: { category: true, variants: true } });
  if (!p) notFound();
  const sizes = sortSizes(p.variants.map((v) => v.size));
  const initial: ProductFormValues = {
    name: p.name, slug: p.slug, brand: p.brand, description: p.description, priceCOP: String(p.priceCOP), compareAtPriceCOP: p.compareAtPriceCOP ? String(p.compareAtPriceCOP) : "",
    category: p.category.slug, gender: p.gender, isAccessory: p.isAccessory, featured: p.featured, active: p.active, images: p.images, tags: p.tags.join(", "),
    stock: String(p.stock), hasSizes: p.variants.length > 0,
    variants: sizes.map((s) => ({ size: s, stock: String(p.variants.find((v) => v.size === s)!.stock) })),
  };
  return (<><PageHeader title="Editar producto" subtitle={p.name} /><ProductForm initial={initial} productId={p.id} /></>);
}
