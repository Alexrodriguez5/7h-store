"use client";

import { useProductFilters } from "@/hooks/useProductFilters";
import { useMemo } from "react";
import type { Category, Product } from "@/types";
import { FilterBar } from "./FilterBar";
import { ProductCard } from "./ProductCard";
import { EmptyState } from "@/components/ui/EmptyState";
import { Button } from "@/components/ui/Button";

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
          description="Prueba otra categoría, cambia los filtros o limpia la búsqueda."
          action={<Button onClick={reset}>Limpiar filtros</Button>}
        />
      ) : (
        <div
          className="grid grid-cols-2 gap-x-5 gap-y-12 sm:grid-cols-3 lg:grid-cols-4 lg:gap-x-6 lg:gap-y-14"
          aria-label="Productos del catálogo"
        >
          {visible.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      )}
    </div>
  );
}
