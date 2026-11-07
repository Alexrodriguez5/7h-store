"use client";

import { useProductFilters } from "@/hooks/useProductFilters";
import { useMemo } from "react";
import type { Category, Product } from "@/types";
import { FilterBar } from "./FilterBar";
import { ProductCard } from "./ProductCard";
import { EmptyState } from "@/components/ui/EmptyState";
import { Button } from "@/components/ui/Button";
import { Reveal } from "@/components/home/Motion";

export function Catalog({ products, categories }: { products: Product[]; categories: Category[] }) {
  const slugs = useMemo(() => categories.map((c) => c.slug), [categories]);
  const { filters, visible, update, reset } = useProductFilters(products, slugs);

  return (
    <div className="space-y-8">
      <FilterBar
        filters={filters}
        categories={categories}
        total={visible.length}
        onChange={update}
        onReset={reset}
      />

      {visible.length === 0 ? (
        <EmptyState
          title="No encontramos productos"
          description={filters.search ? "No lo tenemos todavía, pero podemos buscarlo por ti: cuéntanos qué necesitas." : "Prueba otra categoría, cambia los filtros o limpia la búsqueda."}
          action={
            <div className="flex flex-wrap justify-center gap-3">
              {filters.search && <Button href={`/tu-lo-buscas?q=${encodeURIComponent(filters.search)}`} variant="gold">¿No lo encuentras? AURA lo busca por ti</Button>}
              <Button onClick={reset} variant={filters.search ? "secondary" : "primary"}>Limpiar filtros</Button>
            </div>
          }
        />
      ) : (
        <div
          className="grid grid-cols-2 gap-x-4 gap-y-12 sm:gap-x-5 sm:grid-cols-3 lg:grid-cols-4 lg:gap-x-6 lg:gap-y-14"
          aria-label="Productos del catálogo"
        >
          {visible.map((product, i) => (
            // La primera fila se pinta de inmediato (es lo primero que se ve); el resto aparece al desplazarse.
            i < 4 ? (
              <div key={product.id} className="h-full">
                <ProductCard product={product} priority />
              </div>
            ) : (
              <Reveal key={product.id} delay={(i % 4) * 70} className="h-full">
                <ProductCard product={product} />
              </Reveal>
            )
          ))}
        </div>
      )}
    </div>
  );
}
