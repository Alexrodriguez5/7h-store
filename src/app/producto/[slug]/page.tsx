import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getActiveCategories, getProductBySlug, getProductsByCategory } from "@/services/products";
import { jsonLdScript, siteUrl } from "@/lib/seo";
import { formatCOP } from "@/lib/format";
import { ProductGallery } from "@/components/product/ProductGallery";
import { AddToCart } from "@/components/product/AddToCart";
import { ProductCard } from "@/components/catalog/ProductCard";
import { ChevronDownIcon, ShieldIcon, TruckIcon } from "@/components/ui/Icons";
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const p = await getProductBySlug(slug);
  if (!p) return { title: "Producto no encontrado" };
  const description = `${p.brand} ${p.name}: ${p.description}`.slice(0, 160);
  return {
    title: p.name,
    description,
    alternates: { canonical: `/producto/${p.slug}` },
    openGraph: {
      type: "website",
      url: `/producto/${p.slug}`,
      title: `${p.name} | 7H STORE`,
      description,
      images: p.images[0] ? [{ url: p.images[0], alt: p.name }] : [],
    },
    twitter: { card: "summary_large_image", title: p.name, description, images: p.images[0] ? [p.images[0]] : [] },
  };
}
export default async function ProductPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const p = await getProductBySlug(slug);
  if (!p) notFound();
  const [related, categories] = await Promise.all([getProductsByCategory(p.category, p.id), getActiveCategories()]);
  const categoryLabel = categories.find((c) => c.slug === p.category)?.label ?? p.category;
  const url = `${siteUrl()}/producto/${p.slug}`;
  const discount = p.compareAtPriceCOP
    ? Math.round((1 - p.priceCOP / p.compareAtPriceCOP) * 100)
    : 0;
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: p.name,
    sku: p.id,
    url,
    category: categoryLabel,
    brand: { "@type": "Brand", name: p.brand },
    description: p.description,
    image: p.images,
    offers: {
      "@type": "Offer",
      url,
      priceCurrency: "COP",
      price: p.priceCOP,
      seller: { "@type": "Organization", name: "7H STORE" },
      availability: p.stock > 0 ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
    },
  };
  const breadcrumbLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Inicio", item: `${siteUrl()}/` },
      { "@type": "ListItem", position: 2, name: categoryLabel, item: `${siteUrl()}/catalogo?categoria=${encodeURIComponent(p.category)}` },
      { "@type": "ListItem", position: 3, name: p.name, item: url },
    ],
  };
  return (
    <main id="contenido" className="mx-auto max-w-7xl px-5 py-12 lg:px-8 lg:py-16">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdScript(jsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdScript(breadcrumbLd) }} />
      <nav aria-label="Ruta de navegación" className="mb-8 text-xs text-ink-soft">
        <ol className="flex flex-wrap items-center gap-1.5">
          <li><Link href="/" className="hover:text-gold">Inicio</Link></li>
          <li aria-hidden="true">/</li>
          <li><Link href={`/catalogo?categoria=${encodeURIComponent(p.category)}`} className="hover:text-gold">{categoryLabel}</Link></li>
          <li aria-hidden="true">/</li>
          <li aria-current="page" className="truncate text-ink">{p.name}</li>
        </ol>
      </nav>
      <div className="grid gap-12 lg:grid-cols-2">
        <ProductGallery images={p.images} name={p.name} />
        <div className="lg:pt-6">
          <p className="text-[11px] font-medium uppercase tracking-[.16em] text-ink-soft/70">{p.brand}</p>
          <h1 className="mt-2 font-display text-4xl leading-none sm:text-6xl">{p.name}</h1>
          <div className="mt-5 flex items-end gap-3">
            <span className="font-display text-3xl">{formatCOP(p.priceCOP)}</span>
            {p.compareAtPriceCOP && (
              <del className="text-sm text-ink-soft/60">{formatCOP(p.compareAtPriceCOP)}</del>
            )}
            {discount > 0 && (
              <span className="rounded-full bg-gold px-2.5 py-1 text-[10px] font-semibold text-ink">-{discount}%</span>
            )}
          </div>
          <p className="mt-2 text-xs text-ink-soft">Impuestos incluidos</p>
          <p className="mt-7 max-w-xl text-sm leading-7 text-ink-soft">{p.description}</p>
          <div className="mt-7 flex items-center gap-2 border-y border-ink/10 py-5">
            <span
              aria-hidden="true"
              className={`size-2 rounded-full ${p.stock === 0 ? "bg-error" : p.stock <= 5 ? "bg-warning" : "bg-success"}`}
            />
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
          <div className="mt-6 grid grid-cols-2 gap-3 text-xs text-ink-soft">
            <div className="flex items-center gap-2 rounded-xl bg-ivory-200/60 px-3 py-3">
              <TruckIcon width={18} height={18} className="shrink-0 text-ink" /> Envío a toda Colombia
            </div>
            <div className="flex items-center gap-2 rounded-xl bg-ivory-200/60 px-3 py-3">
              <ShieldIcon width={18} height={18} className="shrink-0 text-ink" /> Producto original
            </div>
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
              <details key={title} className="clean group py-4">
                <summary className="flex cursor-pointer items-center justify-between text-sm font-semibold transition-colors hover:text-gold">
                  {title}
                  <ChevronDownIcon
                    width={18}
                    height={18}
                    className="transition-transform duration-200 group-open:rotate-180"
                  />
                </summary>
                <p className="mt-3 max-w-xl text-sm leading-6 text-ink-soft">{text}</p>
              </details>
            ))}
          </div>
        </div>
      </div>
      {related.length > 0 && (
        <section className="mt-24">
          <h2 className="font-display text-4xl">También te puede gustar</h2>
          <div className="mt-8 grid grid-cols-2 gap-x-4 gap-y-10 sm:grid-cols-4 lg:gap-x-6">
            {related.map((x) => (
              <ProductCard key={x.id} product={x} />
            ))}
          </div>
        </section>
      )}
    </main>
  );
}
