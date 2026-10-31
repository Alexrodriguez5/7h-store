import type { Metadata } from "next";
import { Catalog } from "@/components/catalog/Catalog";
import { getActiveCategories, getProducts } from "@/services/products";

type SP = Promise<{ categoria?: string; q?: string }>;

async function categoryFor(slug?: string) {
  if (!slug) return null;
  try {
    return (await getActiveCategories()).find((c) => c.slug === slug) ?? null;
  } catch {
    return null;
  }
}

/** Cada categoría tiene su propio título, descripción y URL canónica (mejor posicionamiento). */
export async function generateMetadata({ searchParams }: { searchParams: SP }): Promise<Metadata> {
  const { categoria, q } = await searchParams;
  const category = await categoryFor(categoria);
  const title = category ? `${category.label} originales de EE.UU.` : "Catálogo";
  const description = category
    ? `Compra ${category.label.toLowerCase()} originales importados de EE.UU. con precios en COP, impuestos incluidos y envío a toda Colombia.`
    : "Productos originales de EE.UU. con precios en COP, impuestos incluidos y envío a toda Colombia.";
  return {
    title,
    description,
    alternates: { canonical: category ? `/catalogo?categoria=${encodeURIComponent(category.slug)}` : "/catalogo" },
    // Los resultados de búsqueda no se indexan (contenido duplicado).
    robots: q ? { index: false, follow: true } : undefined,
    openGraph: { title: `${title} | 7H STORE`, description, url: "/catalogo" },
  };
}

export default async function CatalogPage({ searchParams }: { searchParams: SP }) {
  const [{ categoria }, products, categories] = await Promise.all([searchParams, getProducts(), getActiveCategories()]);
  const category = categories.find((c) => c.slug === categoria);

  return (
    <main id="contenido" className="mx-auto max-w-7xl px-5 py-10 lg:px-8 lg:py-14">
      <div className="mb-8 max-w-2xl">
        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-gold">7H STORE</p>
        <h1 className="mt-2 font-display text-4xl sm:text-5xl">{category ? category.label : "Catálogo"}</h1>
        <p className="mt-3 max-w-xl text-sm leading-6 text-ink-soft">
          Productos originales de EE.UU., precios en COP e impuestos incluidos.
        </p>
      </div>

      <Catalog products={products} categories={categories} />
    </main>
  );
}
