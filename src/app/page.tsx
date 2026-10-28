import Image from "next/image";
import Link from "next/link";
import { getActiveCategories, getFeaturedProducts } from "@/services/products";
import { ProductCard } from "@/components/catalog/ProductCard";
import { Button } from "@/components/ui/Button";
import { ArrowRightIcon, CardIcon, ShieldIcon, TruckIcon } from "@/components/ui/Icons";
/** Imágenes por defecto de las categorías iniciales (si la categoría no tiene `imageUrl` propia). */
const DEFAULT_CATEGORY_IMAGES: Record<string, string> = {
  tecnologia:
    "https://images.unsplash.com/photo-1498049794561-7780e7231661?auto=format&fit=crop&w=900&q=82",
  ropa: "https://images.unsplash.com/photo-1445205170230-053b83016050?auto=format&fit=crop&w=900&q=82",
  calzado:
    "https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&w=900&q=82",
  accesorios:
    "https://images.unsplash.com/photo-1524805444758-089113d48a6d?auto=format&fit=crop&w=900&q=82",
};

export default async function HomePage() {
  const [featured, categories] = await Promise.all([getFeaturedProducts(), getActiveCategories()]);
  return (
    <main id="contenido">
      <section className="relative overflow-hidden bg-ink text-ivory">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -left-40 top-0 size-[520px] rounded-full bg-gold/10 blur-3xl"
        />
        <div className="relative mx-auto grid max-w-7xl items-center gap-10 px-5 py-20 lg:grid-cols-[1.05fr_.95fr] lg:px-8 lg:py-24">
          <div className="animate-fade-up">
            <p className="inline-flex items-center gap-2 rounded-full border border-gold/30 bg-gold/10 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[.28em] text-gold-light">
              Importados de EE.UU. · Colombia
            </p>
            <h1 className="mt-6 max-w-3xl font-display text-5xl leading-[.94] sm:text-7xl lg:text-[72px]">
              Lo mejor de EE.UU., directo a tu puerta en Colombia.
            </h1>
            <p className="mt-7 max-w-xl text-sm leading-7 text-ivory/65">
              Productos originales, precios en COP con impuestos incluidos y una experiencia de
              compra clara de principio a fin.
            </p>
            <div className="mt-9 flex flex-wrap gap-3">
              <Button href="/catalogo" variant="gold">
                Ver catálogo
                <ArrowRightIcon width={16} height={16} />
              </Button>
              <Button
                href="/pedidos"
                variant="secondary"
                className="border-ivory/25 text-ivory hover:border-gold hover:bg-white/5"
              >
                Rastrear pedido
              </Button>
            </div>
          </div>
          <div className="relative aspect-[4/5] overflow-hidden rounded-[28px] bg-ink-soft shadow-2xl ring-1 ring-white/10">
            <Image
              src="https://images.unsplash.com/photo-1529139574466-a303027c1d8b?auto=format&fit=crop&w=1200&q=85"
              alt="Selección editorial de productos 7H STORE"
              fill
              priority
              sizes="(min-width:1024px) 45vw,100vw"
              className="object-cover opacity-90"
            />
            <div
              aria-hidden="true"
              className="absolute inset-0 bg-gradient-to-t from-ink/50 via-transparent to-transparent"
            />
          </div>
        </div>
      </section>
      <section className="mx-auto max-w-7xl px-5 py-20 lg:px-8">
        <div className="flex items-end justify-between gap-5 pb-2">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-widest text-gold">Explora</p>
            <h2 className="mt-2 font-display text-4xl sm:text-5xl">Compra por categoría.</h2>
          </div>
        </div>
        <div
          className={`mt-8 grid gap-4 sm:grid-cols-2 lg:gap-5 ${categories.length % 3 === 0 && categories.length % 4 !== 0 ? "lg:grid-cols-3" : "lg:grid-cols-4"}`}
        >
          {categories.map((c) => {
            const image = c.imageUrl || DEFAULT_CATEGORY_IMAGES[c.slug];
            return (
              <Link
                key={c.slug}
                href={`/catalogo?categoria=${c.slug}`}
                className="group relative block overflow-hidden rounded-2xl bg-ivory-200 shadow-soft transition-shadow duration-300 hover:shadow-lift"
              >
                <div className="relative aspect-[4/5] overflow-hidden">
                  {image ? (
                    <Image
                      src={image}
                      alt=""
                      fill
                      sizes="(min-width:1024px) 33vw,(min-width:640px) 50vw,100vw"
                      className="object-cover transition-transform duration-700 ease-out group-hover:scale-[1.05]"
                    />
                  ) : (
                    <div
                      aria-hidden="true"
                      className="flex h-full items-center justify-center bg-ink"
                    >
                      <span className="font-display text-5xl text-gold-light">
                        {c.label.charAt(0)}
                      </span>
                    </div>
                  )}
                </div>
                <div
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-0 bg-gradient-to-t from-ink/75 via-ink/10 to-transparent"
                />
                <div className="absolute inset-x-0 bottom-0 flex items-center justify-between p-5 text-ivory">
                  <h3 className="font-display text-3xl">{c.label}</h3>
                  <span className="grid size-9 place-items-center rounded-full bg-ivory/15 backdrop-blur transition-colors group-hover:bg-gold group-hover:text-ink">
                    <ArrowRightIcon width={16} height={16} />
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
      </section>
      <section className="mx-auto max-w-7xl px-5 pb-20 lg:px-8">
        <div className="flex items-end justify-between gap-5 pb-2">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-widest text-gold">
              Selección 7H
            </p>
            <h2 className="mt-2 font-display text-4xl sm:text-5xl">Destacados</h2>
          </div>
          <Link
            href="/catalogo"
            className="hidden items-center gap-2 text-sm font-medium transition-colors hover:text-gold sm:inline-flex"
          >
            Ver todo <ArrowRightIcon width={16} height={16} />
          </Link>
        </div>
        <div className="mt-8 grid grid-cols-2 gap-x-4 gap-y-10 sm:grid-cols-3 lg:grid-cols-4">
          {featured.map((p) => (
            <ProductCard key={p.id} product={p} />
          ))}
        </div>
      </section>
      <section className="bg-ivory-200/60">
        <div className="mx-auto grid max-w-7xl gap-5 px-5 py-20 md:grid-cols-3 lg:px-8">
          {[
            {
              Icon: TruckIcon,
              title: "Envío a todo el país",
              text: "Recibe tus compras donde estés en Colombia.",
            },
            {
              Icon: ShieldIcon,
              title: "Originales de EE.UU.",
              text: "Selección de productos originales y precios transparentes.",
            },
            {
              Icon: CardIcon,
              title: "Pagos locales y seguimiento",
              text: "Tarjeta, PSE, transferencia y seguimiento del pedido.",
            },
          ].map(({ Icon, title, text }) => (
            <div key={title} className="rounded-2xl border border-ink/5 bg-ivory p-6 shadow-soft">
              <span className="grid size-11 place-items-center rounded-full bg-gold/15 text-ink">
                <Icon width={22} height={22} />
              </span>
              <h3 className="mt-4 font-display text-2xl">{title}</h3>
              <p className="mt-2 text-xs leading-6 text-ink-soft">{text}</p>
            </div>
          ))}
        </div>
      </section>
      <section className="bg-ink text-ivory">
        <div className="mx-auto flex max-w-7xl flex-col items-start gap-6 px-5 py-16 sm:flex-row sm:items-center sm:justify-between lg:px-8">
          <p className="font-display text-4xl">Calidad. Estilo. Confianza.</p>
          <Button href="/catalogo" variant="gold">
            Ver catálogo
          </Button>
        </div>
      </section>
    </main>
  );
}
