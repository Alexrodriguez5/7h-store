import type { Metadata } from "next";
import { Catalog } from "@/components/catalog/Catalog";
import { PageBody, PageHero } from "@/components/aura/PageHero";
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
    <main id="contenido">
      <PageHero
        eyebrow="7H STORE · Colección"
        title={category ? `${category.label},` : "Todo lo"}
        accent={category ? "con criterio." : "original."}
        lead="Productos originales de EE.UU., precios en COP e impuestos incluidos. Elige tu talla y agrégalo al carrito sin salir del catálogo."
        crumbs={category ? [{ href: "/", label: "Inicio" }, { href: "/catalogo", label: "Catálogo" }] : undefined}
      />
      <PageBody>
        <Catalog products={products} categories={categories} />
      </PageBody>
    </main>
  );
}
