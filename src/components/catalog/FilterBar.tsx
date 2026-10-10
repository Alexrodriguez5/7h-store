"use client";

import type { FilterState, SortOption } from "@/types";

const G = [
  { value: "todos", label: "Todos" },
  { value: "hombre", label: "Hombre" },
  { value: "mujer", label: "Mujer" },
] as const;

const PRICES: [number | null, string][] = [
  [null, "Cualquier precio"],
  [250000, "Hasta $250.000"],
  [500000, "Hasta $500.000"],
  [1000000, "Hasta $1.000.000"],
  [2000000, "Hasta $2.000.000"],
];

export function FilterBar({
  filters,
  total,
  onChange,
  onReset,
}: {
  filters: FilterState;
  total: number;
  onChange: <K extends keyof FilterState>(key: K, value: FilterState[K]) => void;
  onReset: () => void;
}) {
  const hasFilters =
    filters.search.trim() !== "" ||
    filters.category !== "todo" ||
    filters.gender !== "todos" ||
    filters.onlyAccessories ||
    filters.maxPriceCOP !== null ||
    filters.sort !== "relevancia";

  const chip = (active: boolean) =>
    `border px-3 py-2 text-xs transition-colors ${
      active
        ? "border-ink bg-ink text-ivory"
        : "border-ink/20 bg-transparent hover:border-gold hover:text-ink"
    }`;

  return (
    <section aria-label="Filtros del catálogo" className="border-y border-ink/10 bg-ivory">
      <div className="flex flex-col gap-4 py-5 lg:flex-row lg:items-start lg:gap-8">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="mr-1 text-xs font-semibold uppercase tracking-[0.16em] text-ink-soft">
              Filtrar por
            </span>

            {G.map((gender) => (
              <button
                type="button"
                key={gender.value}
                onClick={() => onChange("gender", gender.value)}
                className={chip(filters.gender === gender.value)}
                aria-pressed={filters.gender === gender.value}
              >
                {gender.label}
              </button>
            ))}

            <label className="flex cursor-pointer items-center gap-2 border border-ink/20 px-3 py-2 text-xs transition-colors hover:border-gold">
              <input
                type="checkbox"
                checked={filters.onlyAccessories}
                onChange={(e) => onChange("onlyAccessories", e.target.checked)}
                className="accent-gold"
              />
              Solo accesorios
            </label>
          </div>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <label htmlFor="catalog-price" className="sr-only">
            Precio máximo
          </label>
          <select
            id="catalog-price"
            value={filters.maxPriceCOP ?? ""}
            onChange={(e) => onChange("maxPriceCOP", e.target.value ? Number(e.target.value) : null)}
            aria-label="Precio máximo"
            className="min-w-48 border border-ink/20 bg-ivory px-3 py-2.5 text-xs outline-none transition-colors focus:border-gold"
          >
            {PRICES.map(([value, label]) => (
              <option key={String(value)} value={value ?? ""}>
                {label}
              </option>
            ))}
          </select>

          <label htmlFor="catalog-sort" className="sr-only">
            Ordenar productos
          </label>
          <select
            id="catalog-sort"
            value={filters.sort}
            onChange={(e) => onChange("sort", e.target.value as SortOption)}
            aria-label="Ordenar productos"
            className="min-w-48 border border-ink/20 bg-ivory px-3 py-2.5 text-xs outline-none transition-colors focus:border-gold"
          >
            <option value="relevancia">Ordenar: Relevancia</option>
            <option value="novedades">Ordenar: Novedades</option>
            <option value="precio-asc">Precio: menor a mayor</option>
            <option value="precio-desc">Precio: mayor a menor</option>
          </select>
        </div>
      </div>

      <div className="flex min-h-12 flex-wrap items-center justify-between gap-3 border-t border-ink/10 py-3">
        <div className="flex flex-wrap items-center gap-2">
          <span aria-live="polite" className="text-sm font-medium">
            {total} {total === 1 ? "producto" : "productos"}
          </span>

          {filters.search.trim() && (
            <span className="border border-gold/70 px-2.5 py-1 text-[11px]">
              Búsqueda: “{filters.search.trim()}”
            </span>
          )}
          {filters.gender !== "todos" && (
            <span className="border border-gold/70 px-2.5 py-1 text-[11px]">
              {filters.gender === "hombre" ? "Hombre" : "Mujer"}
            </span>
          )}
          {filters.onlyAccessories && (
            <span className="border border-gold/70 px-2.5 py-1 text-[11px]">Accesorios</span>
          )}
          {filters.maxPriceCOP !== null && (
            <span className="border border-gold/70 px-2.5 py-1 text-[11px]">
              Máx. ${filters.maxPriceCOP.toLocaleString("es-CO")}
            </span>
          )}
        </div>

        {hasFilters && (
          <button
            type="button"
            onClick={onReset}
            className="text-xs font-medium underline underline-offset-4 transition-colors hover:text-gold"
          >
            Limpiar filtros
          </button>
        )}
      </div>
    </section>
  );
}
