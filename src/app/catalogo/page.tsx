import type { Metadata } from "next";
import { Catalog } from "@/components/catalog/Catalog";
import { getActiveCategories, getProducts } from "@/services/products";

export const metadata: Metadata = {
  title: "Catálogo",
  description: "Productos originales de EE.UU. con precios en COP e impuestos incluidos.",
};

export default async function CatalogPage() {
  const [products, categories] = await Promise.all([getProducts(), getActiveCategories()]);

  return (
    <main id="contenido" className="mx-auto max-w-7xl px-5 py-10 lg:px-8 lg:py-14">
      <div className="mb-8 max-w-2xl">
        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-gold">
          7H STORE
        </p>
        <h1 className="mt-2 font-display text-4xl sm:text-5xl">Catálogo</h1>
        <p className="mt-3 max-w-xl text-sm leading-6 text-ink-soft">
          Productos originales de EE.UU., precios en COP e impuestos incluidos.
        </p>
      </div>

      <Catalog products={products} categories={categories} />
    </main>
  );
}
