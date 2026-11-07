import Image from "next/image";
import Link from "next/link";
import type { Metadata } from "next";
import { getActiveCategories, getFeaturedProducts, getProducts } from "@/services/products";
import { formatCOP } from "@/lib/format";
import { FREE_SHIPPING_THRESHOLD } from "@/lib/shipping";
import { ProductCard } from "@/components/catalog/ProductCard";
import { Button } from "@/components/ui/Button";
import { ArrowRightIcon, CardIcon, ShieldIcon, TruckIcon } from "@/components/ui/Icons";
import { Rail, Reveal } from "@/components/home/Motion";
import { Section, SectionHeader } from "@/components/home/Section";
import { HeroOrb } from "@/components/aura/HeroOrb";
import { BRAND_STORY } from "@/components/brand/BrandStory";
import { GalleryGrid } from "@/components/gallery/GalleryGrid";
import { getPublicMedia } from "@/lib/services/gallery";

/**
 * Fotografía de campaña (Unsplash License, uso comercial permitido, sin marcas visibles):
 * - Hero: arquitectura urbana de concreto bajo un viaducto (lesha tuman, unsplash.com/photos/y9-wngBehYU).
 * Para usar fotos propias de la marca basta con cambiar estas dos URL (o subirlas a Supabase Storage).
 */
const HERO_IMAGE = "https://images.unsplash.com/photo-1780764337454-d222bec28c5c?auto=format&fit=crop&w=2400&q=80";

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

/**
 * Cómo trabajamos: SOLO datos ya publicados en el sitio (Términos, Envíos, checkout).
 * No se usa "Revisado": no hay un procedimiento de inspección documentado que lo respalde.
 */
const STEPS = [
  { n: "01", title: "Lo eliges con el precio final", text: "Productos originales de Estados Unidos con su precio en pesos colombianos, impuestos incluidos. El costo del envío lo ves antes de pagar.", fact: "COP · impuestos incluidos" },
  { n: "02", title: "Pagas por un canal seguro", text: "Tarjeta o PSE a través de Wompi; 7H STORE no guarda los datos de tu tarjeta. También puedes pagar por transferencia o consignación. Tu pedido se confirma cuando el pago queda aprobado.", fact: "Wompi · tarjeta · PSE" },
  { n: "03", title: "Lo sigues hasta tu puerta", text: `Despachamos con transportadora y número de guía, que ves en Mi cuenta. Envío gratis desde ${formatCOP(FREE_SHIPPING_THRESHOLD)}; en compras menores, la tarifa según tu ciudad aparece antes de pagar.`, fact: `Guía · gratis desde ${formatCOP(FREE_SHIPPING_THRESHOLD)}` },
];

const BENEFITS = [
  { Icon: TruckIcon, title: "Envío a todo el país", text: "Transportadora con número de guía y seguimiento desde tu cuenta." },
  { Icon: ShieldIcon, title: "Originales de EE.UU.", text: "Productos originales, precios transparentes y garantía legal." },
  { Icon: CardIcon, title: "Paga como prefieras", text: "Tarjeta, PSE, transferencia o consignación." },
];

export const metadata: Metadata = { alternates: { canonical: "/" } };

export default async function HomePage() {
  const [featured, categories, all, media] = await Promise.all([getFeaturedProducts(), getActiveCategories(), getProducts(), getPublicMedia({ featuredOnly: true, take: 8 }).catch(() => [])]);
  // Novedades: los más recientes (getProducts ya viene ordenado por fecha) que no están en Destacados.
  const featuredIds = new Set(featured.map((p) => p.id));
  const newest = all.filter((p) => !featuredIds.has(p.id)).slice(0, 8);
  // Lookbook "Hecho para la ciudad": productos que el equipo etiqueta "ciudad" en el panel (no se inventa una colección).
  const cityPicks = all.filter((p) => p.stock > 0 && p.tags.some((t) => t.trim().toLowerCase() === "ciudad")).slice(0, 4);

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
          {/* Esfera 7H: obsidiana con filamentos de oro (WebGL2). Ocupa un cuadro fijo: no mueve el diseño al cargar. */}
          <HeroOrb className="order-first -mb-4 mx-auto aspect-square w-[min(74vw,340px)] sm:w-[min(62vw,460px)] lg:order-none lg:mb-0 lg:w-full lg:max-w-[620px]" />
        </div>
      </section>

      {/* Franja de beneficios: quieta (sin animación permanente), sobre el mismo negro del hero. */}
      <div className="border-y border-gold/15 bg-ink text-ivory/75" aria-label="Beneficios de comprar en 7H STORE">
        <ul className="no-scrollbar mx-auto flex max-w-7xl items-center gap-x-8 overflow-x-auto px-5 py-4 text-[10px] font-semibold uppercase tracking-[.24em] lg:justify-between lg:px-8">
          {STRIP.map((t, i) => (
            <li key={t} className="flex shrink-0 items-center gap-8">
              {i > 0 && <span aria-hidden="true" className="size-1 rounded-full bg-gold/70" />}
              {t}
            </li>
          ))}
        </ul>
      </div>

      {/* 01 · DESTACADOS (marfil): la selección que el equipo marca en el panel */}
      {featured.length > 0 && (
        <Section tone="ivory" label="Destacados">
          <SectionHeader index="01" eyebrow="Selección 7H" title="Destacados" lead="Lo que el equipo pone al frente. Precio final en pesos, sin sorpresas al pagar." href="/catalogo" cta="Ver todo" railArrows />
          <div className="mt-12">
            <Rail label="Productos destacados">
              {featured.map((p, i) => (
                <Reveal key={p.id} delay={Math.min(i, 4) * 80} className="w-[72%] shrink-0 snap-start sm:w-[42%] lg:w-[23.5%]">
                  <ProductCard product={p} priority={i < 2} />
                </Reveal>
              ))}
            </Rail>
          </div>
        </Section>
      )}

      {/* 02 · HECHO PARA LA CIUDAD (negro): doble página editorial, foto quieta y nítida */}
      <Section tone="ink" label="Hecho para la ciudad">
        <div className="grid items-center gap-10 lg:grid-cols-12 lg:gap-14">
          <Reveal className="lg:col-span-6">
            <figure>
              <div className="relative aspect-[4/5] overflow-hidden rounded-[22px] sm:aspect-[16/11] lg:aspect-[4/5]">
                <Image src={HERO_IMAGE} alt="Campaña urbana 7H STORE: persona con ropa urbana bajo un viaducto de concreto" fill sizes="(min-width:1024px) 48vw, 100vw" className="object-cover object-[50%_35%]" />
              </div>
              <figcaption className="mt-3 flex items-center gap-3 text-[10px] font-semibold uppercase tracking-[.24em] text-ivory/45">
                <span aria-hidden="true" className="h-px w-6 bg-gold/60" /> Campaña 7H · Ciudad
              </figcaption>
            </figure>
          </Reveal>
          <div className="lg:col-span-6 lg:pl-6">
            <SectionHeader index="02" eyebrow="Campaña 7H" tone="ink" title={<>Hecho para <span className="text-gold-light">la ciudad.</span></>} lead="Piezas originales que viajan desde Estados Unidos hasta tu puerta, listas para tu día a día." />
            {cityPicks.length >= 3 && (
              <Reveal delay={120} className="mt-10">
                <p className="type-eyebrow text-ivory/50">Para armar el look</p>
                <ol className="mt-4 divide-y divide-ivory/10 border-y border-ivory/10">
                  {cityPicks.map((p, i) => (
                    <li key={p.id}>
                      <Link href={`/producto/${p.slug}`} className="group flex items-center gap-4 py-3.5">
                        <span className="w-6 font-display text-sm text-gold-light">{String(i + 1).padStart(2, "0")}</span>
                        <span className="relative size-14 shrink-0 overflow-hidden rounded-xl bg-ivory">
                          {p.images[0] && <Image src={p.images[0]} alt="" fill sizes="56px" className="object-cover transition-transform duration-500 group-hover:scale-105" />}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block text-[10px] font-semibold uppercase tracking-[.18em] text-ivory/50">{p.brand}</span>
                          <span className="block truncate text-sm text-ivory transition-colors group-hover:text-gold-light">{p.name}</span>
                        </span>
                        <span className="type-price text-sm text-ivory/80">{formatCOP(p.priceCOP)}</span>
                      </Link>
                    </li>
                  ))}
                </ol>
              </Reveal>
            )}
            <Reveal delay={160} className="mt-8">
              <Link href="/catalogo" className="group inline-flex items-center gap-2 text-sm font-semibold text-gold-light hover:text-ivory">
                Ver colección <ArrowRightIcon width={16} height={16} className="transition-transform duration-300 group-hover:translate-x-1" />
              </Link>
            </Reveal>
          </div>
        </div>
      </Section>

      {/* 03 · CATEGORÍAS (marfil profundo): mosaico de fotos, sin efectos 3D */}
      {categories.length > 0 && (
        <Section tone="sand" label="Categorías">
          <SectionHeader index="03" eyebrow="Explora" title="Compra por categoría." />
          <div className="mt-12 grid auto-rows-[180px] grid-cols-2 gap-3 sm:auto-rows-[240px] lg:grid-cols-4 lg:gap-4">
            {categories.map((c, i) => {
              const image = c.imageUrl || CATEGORY_EDITORIAL[c.slug]?.src || all.find((p) => p.category === c.slug && p.images[0])?.images[0];
              const big = i === 0;
              return (
                <Reveal key={c.slug} delay={i * 80} className={big ? "col-span-2 row-span-2" : i === 3 ? "col-span-2 lg:col-span-1" : ""}>
                  <Link href={`/catalogo?categoria=${c.slug}`} className="group relative block h-full overflow-hidden rounded-[22px] bg-ink">
                    {image ? (
                      <Image src={image} alt="" fill sizes={big ? "(min-width:1024px) 50vw, 100vw" : "(min-width:1024px) 25vw, 50vw"} className="object-cover transition-transform duration-[900ms] ease-out group-hover:scale-[1.04]" />
                    ) : (
                      <div aria-hidden="true" className="flex h-full items-center justify-center"><span className="font-display text-6xl text-gold-light">{c.label.charAt(0)}</span></div>
                    )}
                    <div aria-hidden="true" className="absolute inset-0 bg-gradient-to-t from-ink/80 via-ink/10 to-transparent" />
                    <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-3 p-5 text-ivory lg:p-6">
                      <div>
                        {CATEGORY_EDITORIAL[c.slug] && <p className="text-[10px] font-semibold uppercase tracking-[.22em] text-gold-light">{CATEGORY_EDITORIAL[c.slug].kicker}</p>}
                        <h3 className={`mt-1 font-display leading-none ${big ? "text-5xl lg:text-6xl" : "text-3xl"}`}>{c.label}</h3>
                      </div>
                      <span className="grid size-10 shrink-0 place-items-center rounded-full border border-ivory/30 transition-colors duration-300 group-hover:border-gold group-hover:bg-gold group-hover:text-ink">
                        <ArrowRightIcon width={16} height={16} />
                      </span>
                    </div>
                  </Link>
                </Reveal>
              );
            })}
          </div>
        </Section>
      )}

      {/* 04 · NOVEDADES (marfil): lo más reciente, en orden de publicación */}
      {newest.length > 0 && (
        <Section tone="ivory" label="Novedades">
          <SectionHeader index="04" eyebrow="Recién llegados" title="Novedades" lead="Lo último que publicamos, del más reciente al más antiguo." href="/catalogo?orden=novedades" cta="Ver más" railArrows />
          <div className="mt-12">
            <Rail label="Novedades">
              {newest.map((p, i) => (
                <Reveal key={p.id} delay={Math.min(i, 4) * 80} className="w-[72%] shrink-0 snap-start sm:w-[42%] lg:w-[23.5%]">
                  <ProductCard product={p} />
                </Reveal>
              ))}
            </Rail>
          </div>
        </Section>
      )}

      {/* ASÍ SE VIVE 7H (marfil profundo): solo contenido aprobado */}
      {media.length > 0 && (
        <Section tone="sand" label="Así se vive 7H">
          <SectionHeader eyebrow="Así se vive 7H" title="Productos reales, en manos reales." href="/asi-se-vive-7h" cta="Ver la galería" />
          <div className="mt-12"><GalleryGrid items={media} /></div>
        </Section>
      )}

      {/* 05 · CÓMO TRABAJAMOS (negro): el recorrido de la compra, con datos ya publicados */}
      <Section tone="ink" label="Cómo trabajamos">
        <SectionHeader index="05" eyebrow="Cómo trabajamos" tone="ink" title={<>De Estados Unidos <span className="text-gold-light">a tu puerta.</span></>} lead="Comprar algo que viene de otro país deja preguntas. Cada paso tiene una respuesta clara antes de que pagues." />
        <ol className="relative mt-14 grid gap-10 md:grid-cols-3 md:gap-8">
          <span aria-hidden="true" className="absolute left-[11px] top-3 bottom-3 w-px bg-gradient-to-b from-gold/60 via-gold/25 to-transparent md:left-0 md:right-0 md:top-[11px] md:bottom-auto md:h-px md:w-auto md:bg-gradient-to-r" />
          {STEPS.map((s, i) => (
            <Reveal as="li" key={s.n} delay={i * 140} className="relative pl-10 md:pl-0 md:pt-12">
              <span aria-hidden="true" className="absolute left-0 top-0 grid size-[23px] place-items-center rounded-full border border-gold/60 bg-ink md:left-0">
                <span className="size-1.5 rounded-full bg-gold-light" />
              </span>
              <p className="font-display text-5xl leading-none text-gold-light/90">{s.n}</p>
              <h3 className="mt-4 text-base font-semibold text-ivory">{s.title}</h3>
              <p className="mt-2 max-w-sm text-sm leading-6 text-ivory/65">{s.text}</p>
              <p className="mt-4 inline-flex rounded-full border border-ivory/15 px-3 py-1 text-[11px] text-ivory/70">{s.fact}</p>
            </Reveal>
          ))}
        </ol>
        <Reveal className="mt-12 flex flex-wrap items-center gap-3">
          <Button href="/como-comprar" variant="secondary" className="border-ivory/25 text-ivory hover:border-gold hover:bg-white/[.06]">Cómo comprar</Button>
          <Link href="/envios" className="group inline-flex items-center gap-2 px-2 text-sm font-medium text-ivory/80 hover:text-gold-light">Condiciones de envío <ArrowRightIcon width={16} height={16} className="transition-transform group-hover:translate-x-1" /></Link>
        </Reveal>
      </Section>

      {/* 06 · SOBRE 7H STORE + lo que garantizamos (marfil): lectura, sin tarjetas */}
      <Section tone="ivory" label="Sobre 7H STORE">
        <div className="grid gap-10 lg:grid-cols-12 lg:gap-14">
          <div className="lg:col-span-5">
            <SectionHeader index="06" eyebrow="Sobre 7H STORE" title={<>Comprar bien, <span className="text-gold-deep">sin complicaciones.</span></>} />
            <Reveal className="mt-8">
              <Link href="/nosotros" className="group inline-flex items-center gap-2 text-sm font-semibold hover:text-gold-deep">
                Conoce la marca <ArrowRightIcon width={16} height={16} className="transition-transform group-hover:translate-x-1" />
              </Link>
            </Reveal>
          </div>
          <Reveal delay={100} className="lg:col-span-7 lg:border-l lg:border-ink/10 lg:pl-14">
            <p className="font-display text-2xl leading-snug sm:text-[28px]">{BRAND_STORY[0]}</p>
            <p className="mt-5 text-[15px] leading-8 text-ink-soft">{BRAND_STORY[2]}</p>
          </Reveal>
        </div>
        <ul className="mt-16 grid gap-8 border-t border-ink/10 pt-10 md:grid-cols-3 md:gap-10">
          {BENEFITS.map(({ Icon, title, text }, i) => (
            <Reveal as="li" key={title} delay={i * 100} className="flex gap-4">
              <span className="grid size-10 shrink-0 place-items-center rounded-full border border-gold/50 text-gold-deep"><Icon width={18} height={18} /></span>
              <div>
                <h3 className="type-h3 !text-xl">{title}</h3>
                <p className="mt-1.5 text-sm leading-6 text-ink-soft">{text}</p>
              </div>
            </Reveal>
          ))}
        </ul>
      </Section>

      {/* 07 · TÚ LO BUSCAS + COMUNIDAD (marfil profundo): dos servicios, cada uno en su panel */}
      <Section tone="sand" label="Servicios 7H">
        <div className="grid gap-4 lg:grid-cols-[1.35fr_1fr]">
          <Reveal className="section-ink flex flex-col rounded-[22px] p-7 text-ivory sm:p-10">
            <p className="type-eyebrow flex items-center gap-3 text-gold-light"><span className="font-display text-sm tracking-normal">07</span><span aria-hidden="true" className="h-px w-8 bg-gold/70" />AURA · Búsqueda personalizada</p>
            <h2 className="type-h2 mt-4">Tú lo necesitas. <span className="text-gold-light">Nosotros buscamos cómo conseguirlo.</span></h2>
            <p className="mt-4 max-w-lg flex-1 text-[15px] leading-7 text-ivory/65">¿No está en la tienda? Cuéntanos qué buscas, con una foto o un enlace si lo tienes, y te prepararemos alternativas con precio y tiempos confirmados.</p>
            <div className="mt-8"><Button href="/tu-lo-buscas" variant="gold">Iniciar búsqueda <ArrowRightIcon width={16} height={16} /></Button></div>
          </Reveal>
          <Reveal delay={100} className="surface flex flex-col rounded-[22px] p-7 sm:p-10">
            <p className="type-eyebrow flex items-center gap-3 text-gold-deep"><span aria-hidden="true" className="h-px w-8 bg-gold" />Comunidad 7H</p>
            <h2 className="type-h3 mt-4">Recomienda, pregunta y propón.</h2>
            <p className="mt-3 flex-1 text-[15px] leading-7 text-ink-soft">Conversa con otros clientes y con el equipo. Un espacio sencillo y moderado.</p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Button href="/comunidad" variant="secondary">Entrar a la comunidad</Button>
              <Link href="/habla-con-7h" className="group inline-flex items-center gap-2 px-2 text-sm font-medium hover:text-gold-deep">Habla con 7H <ArrowRightIcon width={16} height={16} className="transition-transform group-hover:translate-x-1" /></Link>
            </div>
          </Reveal>
        </div>
      </Section>

      {/* 08 · POSVENTA (marfil): cierre sereno antes del footer negro */}
      <Section tone="ivory" label="Posventa">
        <div className="grid gap-8 lg:grid-cols-12 lg:items-end">
          <div className="lg:col-span-7">
            <SectionHeader index="08" eyebrow="Posventa" title="Tu compra no termina al pagar." lead="Desde tu cuenta ves todos tus pedidos, su pago y su envío, y puedes solicitar garantía, cambio o devolución con un número de radicado. Una persona del equipo revisa cada caso." />
          </div>
          <Reveal delay={100} className="flex flex-wrap gap-3 lg:col-span-5 lg:justify-end">
            <Button href="/cuenta">Entrar a mi cuenta</Button>
            <Button href="/devoluciones" variant="secondary">Garantías y devoluciones</Button>
          </Reveal>
        </div>
      </Section>
    </main>
  );
}
