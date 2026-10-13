import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getProductBySlug, getProductsByCategory } from "@/services/products";
import { formatCOP } from "@/lib/format";
import { ProductGallery } from "@/components/product/ProductGallery";
import { AddToCart } from "@/components/product/AddToCart";
import { ProductCard } from "@/components/catalog/ProductCard";
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const p = await getProductBySlug(slug);
  if (!p) return { title: "Producto no encontrado" };
  return {
    title: p.name,
    description: p.description,
    openGraph: {
      title: p.name,
      description: p.description,
      images: p.images[0] ? [p.images[0]] : [],
    },
  };
}
export default async function ProductPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const p = await getProductBySlug(slug);
  if (!p) notFound();
  const related = await getProductsByCategory(p.category, p.id);
  const discount = p.compareAtPriceCOP
    ? Math.round((1 - p.priceCOP / p.compareAtPriceCOP) * 100)
    : 0;
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: p.name,
    brand: { "@type": "Brand", name: p.brand },
    description: p.description,
    image: p.images,
    offers: {
      "@type": "Offer",
      priceCurrency: "COP",
      price: p.priceCOP,
      availability: p.stock > 0 ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
    },
  };
  return (
    <main id="contenido" className="mx-auto max-w-7xl px-5 py-12 lg:px-8 lg:py-16">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <div className="grid gap-12 lg:grid-cols-2">
        <ProductGallery images={p.images} name={p.name} />
        <div className="lg:pt-6">
          <p className="text-xs text-ink-soft">{p.brand}</p>
          <h1 className="mt-2 font-display text-5xl leading-none sm:text-6xl">{p.name}</h1>
          <div className="mt-5 flex items-end gap-3">
            <span className="font-display text-3xl">{formatCOP(p.priceCOP)}</span>
            {p.compareAtPriceCOP && (
              <del className="text-sm text-ink-soft/60">{formatCOP(p.compareAtPriceCOP)}</del>
            )}
            {discount > 0 && (
              <span className="border border-gold px-2 py-1 text-[10px]">-{discount}%</span>
            )}
          </div>
          <p className="mt-2 text-xs text-ink-soft">Impuestos incluidos</p>
          <p className="mt-7 max-w-xl text-sm leading-7 text-ink-soft">{p.description}</p>
          <div className="mt-7 border-y border-ink/10 py-5">
            <p className="text-xs font-semibold">
              {p.stock === 0
                ? "Agotado"
                : p.stock <= 5
                  ? `Quedan ${p.stock} unidades`
                  : `Disponible`}
            </p>
          </div>
          <div className="mt-7">
            <AddToCart product={p} />
          </div>
          <div className="mt-8 divide-y divide-ink/10 border-y border-ink/10">
            {[
              ["Descripción", p.description],
              [
                "Envío y entrega",
                "Envío a toda Colombia. El plazo depende de la ciudad de destino y se confirma en checkout.",
              ],
              [
                "Devoluciones",
                "Solicita una devolución según las condiciones publicadas por 7H STORE.",
              ],
            ].map(([title, text]) => (
              <details key={title} className="py-4">
                <summary className="cursor-pointer text-sm font-semibold">{title}</summary>
                <p className="mt-3 max-w-xl text-sm leading-6 text-ink-soft">{text}</p>
              </details>
            ))}
          </div>
        </div>
      </div>
      {related.length > 0 && (
        <section className="mt-24">
          <h2 className="font-display text-4xl">También te puede gustar</h2>
          <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-4">
            {related.map((x) => (
              <ProductCard key={x.id} product={x} />
            ))}
          </div>
        </section>
      )}
    </main>
  );
}
