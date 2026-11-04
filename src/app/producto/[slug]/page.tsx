import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getActiveCategories, getProductBySlug, getProductsByCategory } from "@/services/products";
import { jsonLdScript, siteUrl } from "@/lib/seo";
import { formatCOP } from "@/lib/format";
import { ProductGallery } from "@/components/product/ProductGallery";
import { AddToCart } from "@/components/product/AddToCart";
import { ProductCard } from "@/components/catalog/ProductCard";
import { CardIcon, ChevronDownIcon, ShieldIcon, TruckIcon } from "@/components/ui/Icons";
import { DEFAULT_ETA, FREE_SHIPPING_THRESHOLD } from "@/lib/shipping";
import { BADGE_TONE_CLS, discountPercent, productBadges } from "@/lib/badges";
import { BUSINESS } from "@/lib/business";
import { ProductSpecs } from "@/components/product/ProductSpecs";
import { ProductVideo } from "@/components/product/ProductVideo";
import { ReviewsSection } from "@/components/product/ReviewsSection";
import { getProductReviews, isVerifiedBuyer } from "@/lib/services/reviews";
import { getCurrentCustomer } from "@/lib/customer/auth";
import { prisma } from "@/lib/prisma";
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
  const discount = discountPercent(p);
  const badges = productBadges(p);
  const confirmed = new Set(p.badges ?? []);
  const [rv, customer] = await Promise.all([getProductReviews(p.id), getCurrentCustomer()]);
  const own = customer ? await prisma.review.findUnique({ where: { productId_customerId: { productId: p.id, customerId: customer.id } }, select: { status: true } }) : null;
  const viewer = {
    loggedIn: !!customer,
    verifiedEmail: !!customer?.emailVerifiedAt,
    verifiedBuyer: customer ? await isVerifiedBuyer(customer, p.id) : false,
    ownStatus: own?.status ?? null,
  };
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
    // Solo con reseñas reales aprobadas.
    ...(rv.count > 0 ? { aggregateRating: { "@type": "AggregateRating", ratingValue: Number(rv.average.toFixed(1)), reviewCount: rv.count } } : {}),
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
    <main id="contenido">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdScript(jsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdScript(breadcrumbLd) }} />
      {/* Sección negra compacta (ruta). El contenido del producto empieza DEBAJO, en la sección marfil: nada cruza el límite. */}
      <section className="hero-light text-ivory">
        <nav aria-label="Ruta de navegación" className="mx-auto max-w-7xl px-5 py-5 text-xs text-ivory/60 lg:px-8">
          <ol className="flex flex-wrap items-center gap-1.5">
            <li><Link href="/" className="hover:text-gold-light">Inicio</Link></li>
            <li aria-hidden="true">/</li>
            <li><Link href={`/catalogo?categoria=${encodeURIComponent(p.category)}`} className="hover:text-gold-light">{categoryLabel}</Link></li>
            <li aria-hidden="true">/</li>
            <li aria-current="page" className="truncate text-ivory">{p.name}</li>
          </ol>
        </nav>
      </section>
      <div className="bg-ivory">
      <div className="mx-auto max-w-7xl px-5 py-10 lg:px-8 lg:py-14">
      <div className="grid gap-12 lg:grid-cols-2">
        <ProductGallery images={p.images} name={p.name} />
        <div className="surface h-fit rounded-[32px] p-6 sm:p-8 lg:sticky lg:top-28">
          <p className="text-[11px] font-bold uppercase tracking-[.22em] text-gold">{p.brand}</p>
          {badges.length > 0 && (
            <ul aria-label="Etiquetas del producto" className="mt-3 flex flex-wrap gap-1.5">
              {badges.map((b) => (
                <li key={b.key} className={`rounded-full px-2.5 py-1 text-[10px] font-semibold tracking-wide ${BADGE_TONE_CLS[b.tone]}`}>{b.label}</li>
              ))}
            </ul>
          )}
          <h1 className="mt-2 type-h2">{p.name}</h1>
          <div className="mt-5 flex flex-wrap items-end gap-3">
            <span className="text-3xl font-extrabold tabular-nums tracking-tight sm:text-4xl">{formatCOP(p.priceCOP)}</span>
            {discount > 0 && p.compareAtPriceCOP && (
              <>
                <del className="text-sm text-ink-soft/60">{formatCOP(p.compareAtPriceCOP)}</del>
                <span className="rounded-full bg-ink px-2.5 py-1 text-[11px] font-bold text-gold-light">
                  Ahorras {formatCOP(p.compareAtPriceCOP - p.priceCOP)} · {discount}%
                </span>
              </>
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
          <a href={`/habla-con-7h?tema=CARACTERISTICAS&producto=${encodeURIComponent(p.slug)}&asunto=${encodeURIComponent(p.name)}`} className="mt-3 inline-flex text-xs font-semibold underline-offset-4 hover:text-gold hover:underline">
            ¿Tienes una pregunta sobre este producto? Habla con 7H STORE
          </a>
          <ul className="mt-6 grid grid-cols-2 gap-3 text-xs text-ink-soft">
            {[
              { Icon: TruckIcon, text: `Envío gratis desde ${formatCOP(FREE_SHIPPING_THRESHOLD)}` },
              { Icon: CardIcon, text: "Pago seguro: tarjeta, PSE o transferencia" },
              { Icon: ShieldIcon, text: confirmed.has("ORIGINAL") ? "Producto original confirmado" : "Envío nacional con guía" },
              { Icon: ShieldIcon, text: "Retracto y garantía legal" },
            ].map(({ Icon, text }) => (
              <li key={text} className="flex items-center gap-2.5 rounded-2xl border border-ink/[.06] bg-white/60 px-3 py-3 leading-snug">
                <span className="grid size-8 shrink-0 place-items-center rounded-full bg-ink text-gold-light"><Icon width={15} height={15} /></span>
                {text}
              </li>
            ))}
          </ul>
          <div className="mt-8 divide-y divide-ink/10 border-y border-ink/10">
            {[
              ["Descripción", p.description],
              [
                "Envío y entrega",
                `Envío a toda Colombia con transportadora y número de guía. Gratis desde ${formatCOP(FREE_SHIPPING_THRESHOLD)}; en compras menores el costo según tu ciudad aparece en el checkout antes de pagar.`,
              ],
              [
                "Devoluciones",
                "Tienes 5 días hábiles desde la entrega para retractarte (art. 47, Ley 1480; salvo excepciones legales) y garantía legal sobre el producto. Solicítalo desde Mi cuenta → Solicitudes y garantías.",
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
      <div className="mt-16 grid gap-8">
        {p.videoUrl && <ProductVideo url={p.videoUrl} name={p.name} />}
        <ProductSpecs product={p} categoryLabel={categoryLabel} eta={BUSINESS.shippingTime ?? DEFAULT_ETA} />
        <ReviewsSection productId={p.id} productSlug={p.slug} reviews={rv.reviews} average={rv.average} histogram={rv.histogram} viewer={viewer} />
      </div>
      {related.length > 0 && (
        <section className="mt-24">
          <h2 className="type-h2">También te puede <span className="text-gold">gustar</span></h2>
          <div className="mt-8 grid grid-cols-2 gap-x-4 gap-y-10 sm:grid-cols-4 lg:gap-x-6">
            {related.map((x) => (
              <ProductCard key={x.id} product={x} />
            ))}
          </div>
        </section>
      )}
      </div>
      </div>
    </main>
  );
}
