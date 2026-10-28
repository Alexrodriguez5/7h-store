"use client";

import type { Category, FilterState, SortOption } from "@/types";

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
  categories,
  total,
  onChange,
  onReset,
}: {
  filters: FilterState;
  categories: Category[];
  total: number;
  onChange: <K extends keyof FilterState>(key: K, value: FilterState[K]) => void;
  onReset: () => void;
}) {
  const categoryLabel = categories.find((c) => c.slug === filters.category)?.label;
  const hasFilters =
    filters.search.trim() !== "" ||
    filters.category !== "todo" ||
    filters.gender !== "todos" ||
    filters.onlyAccessories ||
    filters.maxPriceCOP !== null ||
    filters.sort !== "relevancia";

  const chip = (active: boolean) =>
    `rounded-full border px-4 py-2 text-xs font-medium transition-all duration-200 ${
      active
        ? "border-ink bg-ink text-ivory shadow-soft"
        : "border-ink/15 bg-white/40 hover:border-gold hover:bg-white/70 hover:text-ink"
    }`;

  return (
    <section aria-label="Filtros del catálogo" className="rounded-2xl border border-ink/10 bg-white/50 px-4 shadow-soft backdrop-blur-sm sm:px-5">
      {categories.length > 0 && (
        <nav
          aria-label="Categorías"
          className="no-scrollbar -mx-1 flex gap-2 overflow-x-auto border-b border-ink/10 px-1 py-4"
        >
          {[{ slug: "todo", label: "Todo" }, ...categories].map((c) => (
            <button
              type="button"
              key={c.slug}
              onClick={() => onChange("category", c.slug)}
              className={`shrink-0 ${chip(filters.category === c.slug)}`}
              aria-pressed={filters.category === c.slug}
            >
              {c.label}
            </button>
          ))}
        </nav>
      )}
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

            <label className="flex cursor-pointer items-center gap-2 rounded-full border border-ink/15 bg-white/40 px-4 py-2 text-xs font-medium transition-colors hover:border-gold">
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
            onChange={(e) =>
              onChange("maxPriceCOP", e.target.value ? Number(e.target.value) : null)
            }
            aria-label="Precio máximo"
            className="min-w-48 cursor-pointer border border-ink/15 bg-white/60 px-3.5 py-2.5 text-xs outline-none transition-colors hover:border-ink/30 focus:border-gold"
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
            className="min-w-48 cursor-pointer border border-ink/15 bg-white/60 px-3.5 py-2.5 text-xs outline-none transition-colors hover:border-ink/30 focus:border-gold"
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
            <span className="rounded-full bg-gold/15 px-3 py-1 text-[11px] font-medium text-ink">
              Búsqueda: “{filters.search.trim()}”
            </span>
          )}
          {categoryLabel && (
            <span className="rounded-full bg-gold/15 px-3 py-1 text-[11px] font-medium text-ink">{categoryLabel}</span>
          )}
          {filters.gender !== "todos" && (
            <span className="rounded-full bg-gold/15 px-3 py-1 text-[11px] font-medium text-ink">
              {filters.gender === "hombre" ? "Hombre" : "Mujer"}
            </span>
          )}
          {filters.onlyAccessories && (
            <span className="rounded-full bg-gold/15 px-3 py-1 text-[11px] font-medium text-ink">Accesorios</span>
          )}
          {filters.maxPriceCOP !== null && (
            <span className="rounded-full bg-gold/15 px-3 py-1 text-[11px] font-medium text-ink">
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
