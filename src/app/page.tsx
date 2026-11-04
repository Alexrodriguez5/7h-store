import Image from "next/image";
import Link from "next/link";
import type { Metadata } from "next";
import { getActiveCategories, getFeaturedProducts, getProducts } from "@/services/products";
import { formatCOP } from "@/lib/format";
import { FREE_SHIPPING_THRESHOLD } from "@/lib/shipping";
import { ProductCard } from "@/components/catalog/ProductCard";
import { Button } from "@/components/ui/Button";
import { ArrowRightIcon, CardIcon, ShieldIcon, TruckIcon } from "@/components/ui/Icons";
import { Parallax, Rail, Reveal, Tilt } from "@/components/home/Motion";
import { HeroShowcase, pickShowcase } from "@/components/home/HeroShowcase";
import { BRAND_STORY } from "@/components/brand/BrandStory";

/**
 * Fotografía de campaña (Unsplash License, uso comercial permitido, sin marcas visibles):
 * - Hero: arquitectura urbana de concreto bajo un viaducto (lesha tuman, unsplash.com/photos/y9-wngBehYU).
 * - Editorial: retrato urbano en la calle (Camilla Carvalho, unsplash.com/photos/0Ek6kBewgs4).
 * Para usar fotos propias de la marca basta con cambiar estas dos URL (o subirlas a Supabase Storage).
 */
const HERO_IMAGE = "https://images.unsplash.com/photo-1780764337454-d222bec28c5c?auto=format&fit=crop&w=2400&q=80";
const EDITORIAL_IMAGE = "https://images.unsplash.com/photo-1511474274885-186ea2ca6b24?auto=format&fit=crop&w=1600&q=80";

/**
 * Fotos editoriales por categoría (Unsplash License, sin logos de marcas visibles). Si la categoría tiene
 * imagen propia en el panel (`imageUrl`), esa tiene prioridad.
 */
const CATEGORY_EDITORIAL: Record<string, { src: string; alt: string; kicker: string }> = {
  calzado: { src: "https://images.unsplash.com/photo-1548122018-5e9e8d135d71?auto=format&fit=crop&w=1400&q=80", alt: "Tenis blancos sobre una línea roja en la calle", kicker: "Pisa fuerte" },
  ropa: { src: "https://images.unsplash.com/photo-1445205170230-053b83016050?auto=format&fit=crop&w=1400&q=80", alt: "Perchero con prendas en tonos neutros", kicker: "Capas que hablan" },
  tecnologia: { src: "https://images.unsplash.com/photo-1498049794561-7780e7231661?auto=format&fit=crop&w=1400&q=80", alt: "Audífonos, celular y portátil sobre un escritorio claro", kicker: "Conecta tu día" },
  accesorios: { src: "https://images.unsplash.com/photo-1524805444758-089113d48a6d?auto=format&fit=crop&w=1400&q=80", alt: "Reloj con correa de cuero sobre fondo negro", kicker: "El detalle manda" },
};

/**
 * Imagen de cada categoría: la propia (`imageUrl`, desde el panel) o, si no tiene, la foto de un producto real
 * de esa categoría. Así no se muestran marcas ni artículos que la tienda no vende.
 */

const STRIP = ["Originales de EE.UU.", "Precios en COP con impuestos", "Envío a toda Colombia", "Pagos seguros con Wompi", "Seguimiento desde tu cuenta", "Garantía legal"];

export const metadata: Metadata = { alternates: { canonical: "/" } };

function SectionHead({ kicker, title, href, cta }: { kicker: string; title: string; href?: string; cta?: string }) {
  return (
    <Reveal className="flex items-end justify-between gap-5 pb-2">
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-[.3em] text-gold">{kicker}</p>
        <h2 className="mt-3 type-h2">{title}</h2>
      </div>
      {href && cta && (
        <Link href={href} className="group hidden items-center gap-2 text-sm font-medium transition-colors hover:text-gold sm:mr-28 sm:inline-flex">
          {cta} <ArrowRightIcon width={16} height={16} className="transition-transform group-hover:translate-x-1" />
        </Link>
      )}
    </Reveal>
  );
}

export default async function HomePage() {
  const [featured, categories, all] = await Promise.all([getFeaturedProducts(), getActiveCategories(), getProducts()]);
  // Novedades: los más recientes (getProducts ya viene ordenado por fecha) que no están en Destacados.
  const featuredIds = new Set(featured.map((p) => p.id));
  const newest = all.filter((p) => !featuredIds.has(p.id)).slice(0, 8);
  const showcase = pickShowcase(featured, all);
  const catLabels = Object.fromEntries(categories.map((c) => [c.slug, c.label]));

  return (
    <main id="contenido">
      {/* A. HERO: composición editorial con productos reales del catálogo (sin esfera ni partículas). */}
      <section className="hero-light relative isolate overflow-hidden bg-ink text-ivory">
        <div className="relative mx-auto grid max-w-7xl gap-10 px-5 pb-12 pt-10 sm:pt-14 lg:min-h-[min(86svh,820px)] lg:grid-cols-[1fr_1.08fr] lg:items-center lg:gap-14 lg:px-8 lg:pb-16">
          <div className="relative z-10">
            <p className="rise flex items-center gap-3 text-[11px] font-semibold uppercase tracking-[.28em] text-gold-light">
              <span aria-hidden="true" className="h-px w-8 bg-gold" /> Calidad · Estilo · Confianza
            </p>
            <h1 className="type-hero mt-6">
              <span className="line-mask"><span>Estilo que llega</span></span>
              <span className="line-mask"><span style={{ animationDelay: "90ms" }} className="text-gold-light">sin fronteras.</span></span>
            </h1>
            <p className="rise mt-6 max-w-[34ch] text-[15px] leading-7 text-ivory/70 [animation-delay:200ms] sm:text-base">
              Moda, accesorios y tecnología originales de Estados Unidos. Precios finales en pesos, impuestos incluidos y seguimiento de cada pedido.
            </p>
            <div className="rise mt-8 grid grid-cols-[1.4fr_1fr] gap-2.5 [animation-delay:260ms] sm:flex sm:flex-wrap sm:gap-3">
              <Button href="/catalogo" variant="gold" className="!px-4 sm:!px-6">
                Explorar la tienda <ArrowRightIcon width={16} height={16} />
              </Button>
              <Button href="/pedidos" variant="secondary" className="!px-4 border-ivory/25 text-ivory hover:border-gold hover:bg-white/[.06] sm:!px-6">
                Mis pedidos
              </Button>
            </div>
            <dl className="rise mt-10 grid max-w-md grid-cols-3 divide-x divide-ivory/10 border-y border-ivory/10 [animation-delay:320ms]">
              {[["Originales", "de EE.UU."], ["Precios", "en COP con impuestos"], ["Envío", "a toda Colombia"]].map(([k, v]) => (
                <div key={k} className="px-3 py-3.5 first:pl-0">
                  <dt className="font-display text-lg leading-none">{k}</dt>
                  <dd className="mt-1.5 text-[11px] leading-4 text-ivory/55">{v}</dd>
                </div>
              ))}
            </dl>
          </div>
          <div className="rise [animation-delay:120ms]">
            <HeroShowcase products={showcase} labels={catLabels} />
          </div>
        </div>
      </section>

      {/* Franja en movimiento (se detiene con el cursor y con movimiento reducido) */}
      <div className="marquee-wrap overflow-hidden border-y border-ink/10 bg-gold py-3 text-ink" aria-label="Beneficios de comprar en 7H STORE">
        <ul className="marquee flex w-max gap-10 whitespace-nowrap text-[11px] font-semibold uppercase tracking-[.25em]">
          {[...STRIP, ...STRIP].map((t, i) => (
            <li key={i} aria-hidden={i >= STRIP.length} className="flex items-center gap-10">{t}<span aria-hidden="true">✦</span></li>
          ))}
        </ul>
      </div>

      {/* B. DESTACADOS EN CARRUSEL */}
      {featured.length > 0 && (
        <section className="mx-auto max-w-7xl px-5 py-20 lg:px-8 lg:py-28">
          <SectionHead kicker="Selección 7H" title="Destacados" href="/catalogo" cta="Ver todo" />
          <div className="mt-10">
            <Rail label="Productos destacados">
              {featured.map((p, i) => (
                <Reveal key={p.id} delay={Math.min(i, 4) * 80} className="w-[68%] shrink-0 snap-start sm:w-[40%] lg:w-[23%]">
                  <ProductCard product={p} priority={i < 2} />
                </Reveal>
              ))}
            </Rail>
          </div>
        </section>
      )}

      {/* B2. CAMPAÑA URBANA: banda cinematográfica a todo el ancho con parallax */}
      <section className="relative isolate h-[70svh] min-h-[420px] overflow-hidden bg-ink text-ivory">
        <Parallax className="absolute inset-0 -z-10 h-[125%] -top-[12%]" strength={0.12}>
          <Image src={HERO_IMAGE} alt="Campaña urbana 7H STORE: persona con ropa urbana bajo un viaducto de concreto" fill sizes="100vw" className="object-cover object-[50%_35%]" />
        </Parallax>
        <div aria-hidden="true" className="absolute inset-0 -z-10 bg-gradient-to-r from-ink/85 via-ink/40 to-transparent" />
        <div className="mx-auto flex h-full max-w-7xl items-end px-5 pb-14 lg:px-8">
          <Reveal className="glass-dark max-w-md rounded-[28px] p-7">
            <p className="text-[10px] font-semibold uppercase tracking-[.3em] text-gold-light">Campaña 7H</p>
            <h2 className="mt-3 type-h2">Hecho para <span className="text-gold-light">la ciudad.</span></h2>
            <p className="mt-3 text-sm leading-6 text-ivory/70">Piezas originales que viajan desde Estados Unidos hasta tu puerta, listas para tu día a día.</p>
            <Link href="/catalogo" className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-gold-light hover:text-ivory">Ver colección <ArrowRightIcon width={16} height={16} /></Link>
          </Reveal>
        </div>
      </section>

      {/* C. CATEGORÍAS EN COMPOSICIÓN ASIMÉTRICA */}
      {categories.length > 0 && (
        <section className="bg-ink py-20 text-ivory lg:py-28">
          <div className="mx-auto max-w-7xl px-5 lg:px-8">
            <Reveal>
              <p className="text-[10px] font-semibold uppercase tracking-[.3em] text-gold">Explora</p>
              <h2 className="mt-3 type-h2">Compra por categoría.</h2>
            </Reveal>
            <div className="mt-10 grid auto-rows-[220px] grid-cols-2 gap-3 sm:auto-rows-[260px] lg:grid-cols-4 lg:gap-4">
              {categories.map((c, i) => {
                const image = c.imageUrl || CATEGORY_EDITORIAL[c.slug]?.src || all.find((p) => p.category === c.slug && p.images[0])?.images[0];
                const big = i === 0;
                return (
                  <Reveal key={c.slug} delay={i * 90} className={big ? "col-span-2 row-span-2" : i === 3 ? "col-span-2 lg:col-span-1" : ""}>
                    <Tilt className="h-full rounded-2xl" max={5}>
                    <Link href={`/catalogo?categoria=${c.slug}`} className="group relative block h-full overflow-hidden rounded-2xl bg-ink-soft">
                      {image ? (
                        <Image src={image} alt="" fill sizes={big ? "(min-width:1024px) 50vw, 100vw" : "(min-width:1024px) 25vw, 50vw"} className="object-cover transition-transform duration-[1200ms] ease-out group-hover:scale-[1.07]" />
                      ) : (
                        <div aria-hidden="true" className="flex h-full items-center justify-center"><span className="font-display text-6xl text-gold-light">{c.label.charAt(0)}</span></div>
                      )}
                      <div aria-hidden="true" className="absolute inset-0 bg-gradient-to-t from-ink/85 via-ink/15 to-transparent transition-opacity duration-500 group-hover:opacity-90" />
                      <div className="absolute inset-x-0 bottom-0 flex items-end justify-between p-5 lg:p-6">
                        <h3 className={`font-display leading-none ${big ? "text-5xl lg:text-7xl" : "text-3xl lg:text-4xl"}`}>{c.label}</h3>
                        <span className="grid size-10 shrink-0 place-items-center rounded-full border border-ivory/30 transition-all duration-300 group-hover:rotate-[-45deg] group-hover:border-gold group-hover:bg-gold group-hover:text-ink">
                          <ArrowRightIcon width={16} height={16} />
                        </span>
                      </div>
                    </Link>
                    </Tilt>
                  </Reveal>
                );
              })}
            </div>
          </div>
        </section>
      )}

      {/* C2. LA EDICIÓN 7H: carrusel editorial a pantalla ancha */}
      {categories.some((c) => CATEGORY_EDITORIAL[c.slug]) && (
        <section className="overflow-hidden bg-ivory py-20 lg:py-28">
          <div className="mx-auto max-w-7xl px-5 lg:px-8">
            <SectionHead kicker="La edición 7H" title="Viste la ciudad." />
            <div className="mt-10">
              <Rail label="La edición 7H">
                {categories.filter((c) => CATEGORY_EDITORIAL[c.slug]).map((c, i) => {
                  const ed = CATEGORY_EDITORIAL[c.slug];
                  return (
                    <Reveal key={c.slug} delay={i * 100} className="w-[82%] shrink-0 snap-start sm:w-[58%] lg:w-[40%]">
                      <Link href={`/catalogo?categoria=${c.slug}`} className="group relative block aspect-[4/5] overflow-hidden rounded-[28px] bg-ink">
                        <Image src={ed.src} alt={ed.alt} fill sizes="(min-width:1024px) 40vw, 82vw" className="reveal-clip object-cover transition-transform duration-[1400ms] ease-out group-hover:scale-[1.06]" />
                        <div aria-hidden="true" className="absolute inset-0 bg-gradient-to-t from-ink/85 via-ink/10 to-transparent" />
                        <div className="absolute inset-x-0 bottom-0 p-6 text-ivory lg:p-8">
                          <p className="text-[10px] font-semibold uppercase tracking-[.3em] text-gold-light">{ed.kicker}</p>
                          <h3 className="mt-2 font-sans text-4xl font-semibold uppercase leading-none tracking-tight lg:text-5xl">{c.label}</h3>
                          <span className="mt-5 inline-flex items-center gap-2 rounded-full bg-ivory px-5 py-2.5 text-xs font-semibold text-ink transition-colors group-hover:bg-gold">
                            Explorar <ArrowRightIcon width={14} height={14} />
                          </span>
                        </div>
                      </Link>
                    </Reveal>
                  );
                })}
              </Rail>
            </div>
          </div>
        </section>
      )}

      {/* D. NOVEDADES */}
      {newest.length > 0 && (
        <section className="mx-auto max-w-7xl px-5 py-20 lg:px-8 lg:py-28">
          <SectionHead kicker="Recién llegados" title="Novedades" href="/catalogo?orden=novedades" cta="Ver más" />
          <div className="mt-10">
            <Rail label="Novedades">
              {newest.map((p, i) => (
                <Reveal key={p.id} delay={Math.min(i, 4) * 80} className="w-[68%] shrink-0 snap-start sm:w-[40%] lg:w-[23%]">
                  <ProductCard product={p} />
                </Reveal>
              ))}
            </Rail>
          </div>
        </section>
      )}

      {/* E/G. EDITORIAL: IMPORTACIÓN, AUTENTICIDAD Y ENVÍO */}
      <section className="relative overflow-hidden bg-ivory-200/60">
        <div className="mx-auto grid max-w-7xl items-center gap-10 px-5 py-20 lg:grid-cols-2 lg:gap-16 lg:px-8 lg:py-28">
          <Reveal className="relative aspect-[4/5] overflow-hidden rounded-[28px] shadow-lift sm:aspect-[5/4] lg:aspect-[4/5]">
            <Image src={EDITORIAL_IMAGE} alt="Retrato urbano de campaña 7H STORE" fill sizes="(min-width:1024px) 50vw, 100vw" className="object-cover transition-transform duration-[1500ms] ease-out hover:scale-[1.04]" />
            <div aria-hidden="true" className="absolute inset-0 bg-gradient-to-t from-ink/40 to-transparent" />
            <p className="absolute bottom-5 left-5 rounded-full bg-ink/70 px-4 py-2 text-[10px] font-semibold uppercase tracking-[.25em] text-gold-light backdrop-blur">De EE.UU. a tu puerta</p>
          </Reveal>
          <div>
            <Reveal>
              <p className="text-[10px] font-semibold uppercase tracking-[.3em] text-gold">Cómo trabajamos</p>
              <h2 className="mt-3 type-h2">Importado. Revisado. Entregado.</h2>
            </Reveal>
            <ol className="mt-10 space-y-6">
              {[
                ["01", "Originales de Estados Unidos", "Traemos productos originales y publicamos su precio final en pesos colombianos, con impuestos incluidos."],
                ["02", "Pago seguro", "Tarjeta y PSE con Wompi; 7H STORE no guarda los datos de tu tarjeta. El pedido se confirma cuando la pasarela aprueba el pago."],
                ["03", "Envío con guía", `Despachamos con transportadora y número de guía. Envío gratis desde ${formatCOP(FREE_SHIPPING_THRESHOLD)}; en compras menores la tarifa se calcula según tu ciudad antes de pagar.`],
              ].map(([n, t, d], i) => (
                <Reveal as="li" key={n} delay={i * 120} className="flex gap-5 border-t border-ink/10 pt-6">
                  <span className="font-display text-3xl text-gold">{n}</span>
                  <div>
                    <h3 className="text-base font-semibold">{t}</h3>
                    <p className="mt-1 text-sm leading-6 text-ink-soft">{d}</p>
                  </div>
                </Reveal>
              ))}
            </ol>
            <Reveal className="mt-8 flex flex-wrap gap-3">
              <Button href="/como-comprar" variant="secondary">Cómo comprar</Button>
              <Link href="/envios" className="inline-flex items-center gap-2 px-2 text-sm font-medium hover:text-gold">Condiciones de envío <ArrowRightIcon width={16} height={16} /></Link>
            </Reveal>
          </div>
        </div>
      </section>

      {/* SOBRE 7H STORE: presentación institucional de la marca */}
      <section className="px-5 pt-20 lg:px-8 lg:pt-28">
        <div className="mx-auto grid max-w-7xl gap-10 lg:grid-cols-[1fr_1.2fr] lg:items-center">
          <Reveal>
            <p className="text-[10px] font-semibold uppercase tracking-[.3em] text-gold">Sobre 7H STORE</p>
            <h2 className="mt-3 type-h2">Comprar bien, <span className="text-gold">sin complicaciones.</span></h2>
            <Link href="/nosotros" className="group mt-8 inline-flex items-center gap-2 text-sm font-semibold hover:text-gold">
              Conoce la marca <ArrowRightIcon width={16} height={16} className="transition-transform group-hover:translate-x-1" />
            </Link>
          </Reveal>
          <Reveal delay={120} className="surface rounded-[28px] p-7 sm:p-10">
            <p className="font-display text-2xl leading-snug sm:text-3xl">{BRAND_STORY[0]}</p>
            <p className="mt-5 text-sm leading-7 text-ink-soft sm:text-base sm:leading-8">{BRAND_STORY[2]}</p>
          </Reveal>
        </div>
      </section>

      {/* F. BENEFICIOS */}
      <section className="mx-auto grid max-w-7xl gap-4 px-5 py-20 md:grid-cols-3 lg:px-8">
        {[
          { Icon: TruckIcon, title: "Envío a todo el país", text: "Transportadora con número de guía y seguimiento desde tu cuenta." },
          { Icon: ShieldIcon, title: "Originales de EE.UU.", text: "Productos originales, precios transparentes y garantía legal." },
          { Icon: CardIcon, title: "Paga como prefieras", text: "Tarjeta, PSE, transferencia o consignación." },
        ].map(({ Icon, title, text }, i) => (
          <Reveal key={title} delay={i * 100} className="surface surface-hover group rounded-[24px] p-7">
            <span className="grid size-12 place-items-center rounded-full bg-ink text-gold-light transition-colors group-hover:bg-gold group-hover:text-ink">
              <Icon width={22} height={22} />
            </span>
            <h3 className="mt-5 font-display text-2xl">{title}</h3>
            <p className="mt-2 text-sm leading-6 text-ink-soft">{text}</p>
          </Reveal>
        ))}
      </section>

      {/* H. CONFIANZA Y ATENCIÓN */}
      <section className="px-5 pb-20 lg:px-8">
        <Reveal className="relative mx-auto max-w-7xl overflow-hidden rounded-[32px] bg-ink px-6 py-14 text-ivory sm:px-12 lg:py-20">
          <div aria-hidden="true" className="iso-grid absolute inset-0 opacity-60" />
          <div aria-hidden="true" className="absolute -right-24 -top-24 size-80 rounded-full bg-gold/20 blur-3xl" />
          <div className="relative grid gap-10 lg:grid-cols-[1.3fr_1fr] lg:items-end">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[.3em] text-gold">Posventa</p>
              <h2 className="mt-3 type-h2">Tu compra no termina al pagar.</h2>
              <p className="mt-5 max-w-lg text-sm leading-7 text-ivory/70">
                Desde tu cuenta ves todos tus pedidos, su pago y su envío, y puedes solicitar garantía, cambio o devolución con un número de radicado. Una persona del equipo revisa cada caso.
              </p>
            </div>
            <div className="flex flex-wrap gap-3 lg:justify-end">
              <Button href="/cuenta" variant="gold">Entrar a mi cuenta</Button>
              <Button href="/devoluciones" variant="secondary" className="border-ivory/30 text-ivory hover:border-gold hover:bg-white/5">Garantías y devoluciones</Button>
            </div>
          </div>
        </Reveal>
      </section>
    </main>
  );
}
