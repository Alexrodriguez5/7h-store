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
import { AuraParticles, AuraVisual } from "@/components/aura/AuraVisual";
import { BRAND_STORY } from "@/components/brand/BrandStory";
import { GalleryGrid } from "@/components/gallery/GalleryGrid";
import { getPublicMedia } from "@/lib/services/gallery";

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
        <h2 className="mt-3 font-display text-4xl leading-none sm:text-6xl">{title}</h2>
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
  const [featured, categories, all, media] = await Promise.all([getFeaturedProducts(), getActiveCategories(), getProducts(), getPublicMedia({ featuredOnly: true, take: 8 }).catch(() => [])]);
  // Novedades: los más recientes (getProducts ya viene ordenado por fecha) que no están en Destacados.
  const featuredIds = new Set(featured.map((p) => p.id));
  const newest = all.filter((p) => !featuredIds.has(p.id)).slice(0, 8);

  return (
    <main id="contenido">
      {/* A. HERO 7H AURA: escena oscura con la esfera de vidrio líquido, halo dorado y partículas */}
      <section className="aura-bg grain relative isolate overflow-hidden text-ivory">
        <AuraParticles />
        <div className="relative mx-auto grid min-h-[86svh] max-w-7xl items-center gap-6 px-5 pb-14 pt-10 lg:min-h-[90svh] lg:grid-cols-[1.08fr_.92fr] lg:px-8 lg:pb-16">
          <div className="relative z-10 order-2 lg:order-1">
            <p className="animate-fade-up inline-flex items-center gap-2 rounded-full border border-gold/30 bg-white/5 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[.32em] text-gold-light backdrop-blur">
              <span className="size-1.5 rounded-full bg-gold-light shadow-[0_0_10px_#d8b866]" /> Calidad. Estilo. Confianza.
            </p>
            <h1 className="mt-6 font-display text-[54px] leading-[.92] sm:text-8xl lg:text-[112px]">
              <span className="line-mask"><span>Estilo que llega</span></span>
              <span className="line-mask"><span style={{ animationDelay: "120ms" }} className="text-aura italic">sin fronteras.</span></span>
            </h1>
            <p className="animate-fade-up mt-6 max-w-md text-base leading-7 text-ivory/75 [animation-delay:320ms]">
              Productos originales de Estados Unidos. Una experiencia de compra diferente: precios en pesos, impuestos incluidos y seguimiento desde tu cuenta.
            </p>
            <div className="animate-fade-up mt-8 flex flex-wrap gap-3 [animation-delay:420ms]">
              <Button href="/catalogo" variant="gold" className="transition-transform hover:-translate-y-0.5">
                Explorar la tienda <ArrowRightIcon width={16} height={16} />
              </Button>
              <Button href="/pedidos" variant="secondary" className="border-ivory/25 bg-white/5 text-ivory backdrop-blur hover:border-gold hover:bg-white/10">
                Mis pedidos
              </Button>
            </div>
            <ul className="animate-fade-up mt-10 grid max-w-lg grid-cols-3 gap-2 [animation-delay:520ms]">
              {[["100%", "Originales de EE.UU."], ["COP", "Impuestos incluidos"], ["24/7", "Pedidos en tu cuenta"]].map(([k, v]) => (
                <li key={v} className="glass-dark rounded-2xl px-3 py-3">
                  <p className="font-display text-2xl leading-none text-gold-light">{k}</p>
                  <p className="mt-1 text-[10px] leading-4 text-ivory/60">{v}</p>
                </li>
              ))}
            </ul>
          </div>
          <AuraVisual className="relative order-1 mx-auto aspect-square w-[64%] max-w-[560px] sm:w-[70%] lg:order-2 lg:w-full" />
        </div>
        <div aria-hidden="true" className="absolute bottom-5 left-1/2 hidden -translate-x-1/2 flex-col items-center gap-2 text-[9px] uppercase tracking-[.4em] text-ivory/45 lg:flex">
          Desliza
          <span className="scroll-cue block h-10 w-px bg-ivory/40" />
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
            <h2 className="mt-3 font-display text-4xl leading-[.95] sm:text-5xl">Hecho para <span className="italic text-gold-light">la ciudad.</span></h2>
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
              <h2 className="mt-3 font-display text-4xl leading-none sm:text-6xl">Compra por categoría.</h2>
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

      {/* ASÍ SE VIVE 7H: solo contenido aprobado (de la tienda o de clientes con su autorización) */}
      {media.length > 0 && (
        <section className="mx-auto max-w-7xl px-5 py-20 lg:px-8 lg:py-28">
          <SectionHead kicker="Así se vive 7H" title="Productos reales, en manos reales." href="/asi-se-vive-7h" cta="Ver la galería" />
          <div className="mt-10"><GalleryGrid items={media} /></div>
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
              <h2 className="mt-3 font-display text-4xl leading-[.95] sm:text-6xl">Importado. Revisado. Entregado.</h2>
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
            <h2 className="mt-3 font-display text-4xl leading-[.95] sm:text-6xl">Comprar bien, <span className="italic text-gold">sin complicaciones.</span></h2>
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

      {/* TÚ LO BUSCAS + COMUNIDAD */}
      <section className="mx-auto grid max-w-7xl gap-4 px-5 pb-20 lg:grid-cols-[1.4fr_1fr] lg:px-8">
        <Reveal className="hero-light relative overflow-hidden rounded-[28px] p-7 text-ivory sm:p-10">
          <p className="type-eyebrow text-gold-light">Tú lo buscas</p>
          <h2 className="type-h2 mt-3">Tú lo buscas. <span className="text-gold-light">Nosotros lo exploramos.</span></h2>
          <p className="mt-4 max-w-lg text-sm leading-7 text-ivory/70">Cuéntanos qué producto estás buscando. Déjanos tu solicitud y exploraremos las posibilidades de conseguirlo.</p>
          <div className="mt-7"><Button href="/tu-lo-buscas" variant="gold">Hacer una solicitud <ArrowRightIcon width={16} height={16} /></Button></div>
        </Reveal>
        <Reveal delay={100} className="surface flex flex-col rounded-[28px] p-7 sm:p-10">
          <p className="type-eyebrow text-gold">Comunidad 7H</p>
          <h2 className="type-h3 mt-3">Recomienda, pregunta y propón.</h2>
          <p className="mt-3 flex-1 text-sm leading-7 text-ink-soft">Conversa con otros clientes y con el equipo. Un espacio sencillo y moderado.</p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Button href="/comunidad" variant="secondary">Entrar a la comunidad</Button>
            <Link href="/habla-con-7h" className="inline-flex items-center gap-2 px-2 text-sm font-medium hover:text-gold">Habla con 7H <ArrowRightIcon width={16} height={16} /></Link>
          </div>
        </Reveal>
      </section>

      {/* H. CONFIANZA Y ATENCIÓN */}
      <section className="px-5 pb-20 lg:px-8">
        <Reveal className="relative mx-auto max-w-7xl overflow-hidden rounded-[32px] bg-ink px-6 py-14 text-ivory sm:px-12 lg:py-20">
          <div aria-hidden="true" className="iso-grid absolute inset-0 opacity-60" />
          <div aria-hidden="true" className="absolute -right-24 -top-24 size-80 rounded-full bg-gold/20 blur-3xl" />
          <div className="relative grid gap-10 lg:grid-cols-[1.3fr_1fr] lg:items-end">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[.3em] text-gold">Posventa</p>
              <h2 className="mt-3 font-display text-4xl leading-[.95] sm:text-6xl">Tu compra no termina al pagar.</h2>
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
