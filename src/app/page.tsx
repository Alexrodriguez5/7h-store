import Image from "next/image";
import Link from "next/link";
import { getActiveCategories, getFeaturedProducts } from "@/services/products";
import { ProductCard } from "@/components/catalog/ProductCard";
import { Button } from "@/components/ui/Button";
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
      <section className="bg-ink text-ivory">
        <div className="mx-auto grid max-w-7xl items-center gap-10 px-5 py-20 lg:grid-cols-[1.05fr_.95fr] lg:px-8 lg:py-24">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[.28em] text-gold-light">
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
              </Button>
              <Button
                href="/pedidos"
                variant="secondary"
                className="border-ivory/30 text-ivory hover:border-gold"
              >
                Rastrear pedido
              </Button>
            </div>
          </div>
          <div className="relative aspect-[4/5] overflow-hidden bg-ink-soft">
            <Image
              src="https://images.unsplash.com/photo-1529139574466-a303027c1d8b?auto=format&fit=crop&w=1200&q=85"
              alt="Selección editorial de productos 7H STORE"
              fill
              priority
              sizes="(min-width:1024px) 45vw,100vw"
              className="object-cover opacity-90"
            />
          </div>
        </div>
      </section>
      <section className="mx-auto max-w-7xl px-5 py-20 lg:px-8">
        <div className="flex items-end justify-between gap-5 border-b border-ink/10 pb-7">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-widest text-gold">Explora</p>
            <h2 className="mt-2 font-display text-4xl sm:text-5xl">Compra por categoría.</h2>
          </div>
        </div>
        <div
          className={`mt-8 grid gap-px border border-ink/10 bg-ink/10 sm:grid-cols-2 ${categories.length % 3 === 0 && categories.length % 4 !== 0 ? "lg:grid-cols-3" : "lg:grid-cols-4"}`}
        >
          {categories.map((c) => {
            const image = c.imageUrl || DEFAULT_CATEGORY_IMAGES[c.slug];
            return (
              <Link key={c.slug} href={`/catalogo?categoria=${c.slug}`} className="group bg-ivory">
                <div className="relative aspect-[4/5] overflow-hidden bg-ivory-200">
                  {image ? (
                    <Image
                      src={image}
                      alt=""
                      fill
                      sizes="(min-width:1024px) 25vw,50vw"
                      className="object-cover transition-transform duration-500 group-hover:scale-[1.02]"
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
                <div className="flex items-center justify-between p-5">
                  <h3 className="font-display text-2xl">{c.label}</h3>
                  <span className="text-xs text-gold">Explorar →</span>
                </div>
              </Link>
            );
          })}
        </div>
      </section>
      <section className="mx-auto max-w-7xl px-5 pb-20 lg:px-8">
        <div className="border-b border-ink/10 pb-7">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-gold">
            Selección 7H
          </p>
          <h2 className="mt-2 font-display text-4xl">Destacados</h2>
        </div>
        <div className="mt-8 grid grid-cols-2 gap-x-4 gap-y-10 sm:grid-cols-3 lg:grid-cols-4">
          {featured.map((p) => (
            <ProductCard key={p.id} product={p} />
          ))}
        </div>
      </section>
      <section className="bg-ivory-200/60">
        <div className="mx-auto grid max-w-7xl gap-8 px-5 py-20 md:grid-cols-3 lg:px-8">
          <div>
            <h3 className="font-display text-2xl">Envío a todo el país</h3>
            <p className="mt-2 text-xs leading-6 text-ink-soft">
              Recibe tus compras donde estés en Colombia.
            </p>
          </div>
          <div>
            <h3 className="font-display text-2xl">Originales de EE.UU.</h3>
            <p className="mt-2 text-xs leading-6 text-ink-soft">
              Selección de productos originales y precios transparentes.
            </p>
          </div>
          <div>
            <h3 className="font-display text-2xl">Pagos locales y seguimiento</h3>
            <p className="mt-2 text-xs leading-6 text-ink-soft">
              Tarjeta, PSE, transferencia y seguimiento del pedido.
            </p>
          </div>
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
