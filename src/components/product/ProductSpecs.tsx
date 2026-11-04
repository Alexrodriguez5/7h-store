import type { Product } from "@/types";

/**
 * Ficha de información del producto. Muestra SOLO lo registrado: si un dato no existe, su fila no aparece.
 * El origen y la garantía específica solo se muestran si el administrador los confirmó.
 */
export function ProductSpecs({ product: p, categoryLabel, eta }: { product: Product; categoryLabel: string; eta: string }) {
  const info = p.info ?? {};
  const availableSizes = p.variants ? p.variants.filter((v) => v.stock > 0).map((v) => v.size) : p.sizes;
  const rows: [string, string | undefined][] = [
    ["Marca", p.brand],
    ["Modelo", info.model],
    ["Categoría", categoryLabel],
    ["Material", info.material],
    ["Color", info.color],
    ["Tallas disponibles", availableSizes?.length ? availableSizes.join(" · ") : undefined],
    ["Estado", info.condition],
    ["Disponibilidad", p.stock === 0 ? "Agotado" : p.stock <= 3 ? `Últimas ${p.stock} unidades` : "Disponible"],
    ["Origen", info.origin],
    ["Garantía", info.warranty ? `${info.warranty} · además de la garantía legal` : "Garantía legal (Ley 1480 de 2011)"],
    ["Entrega estimada", `${eta}, desde la confirmación del pago`],
  ];
  return (
    <section aria-labelledby="ficha" className="surface rounded-[28px] p-6 sm:p-9">
      <p className="text-[10px] font-semibold uppercase tracking-[.3em] text-gold">Ficha del producto</p>
      <h2 id="ficha" className="mt-2 font-display text-3xl sm:text-4xl">Todo lo que debes saber</h2>
      <div className={`mt-6 grid gap-8 ${info.features?.length ? "lg:grid-cols-[1.2fr_1fr]" : ""}`}>
        <dl className="divide-y divide-ink/[.07] text-sm">
          {rows.filter(([, v]) => v).map(([k, v]) => (
            <div key={k} className="grid grid-cols-[minmax(0,140px)_1fr] gap-4 py-3">
              <dt className="text-ink-soft">{k}</dt>
              <dd className="font-medium">{v}</dd>
            </div>
          ))}
        </dl>
        {info.features?.length ? (
          <div>
            <h3 className="text-[11px] font-semibold uppercase tracking-[.22em] text-ink-soft">Características</h3>
            <ul className="mt-4 space-y-3 text-sm">
              {info.features.map((f) => (
                <li key={f} className="flex gap-3">
                  <span aria-hidden="true" className="mt-1.5 size-2 shrink-0 rounded-full bg-gold shadow-[0_0_8px_rgb(201_164_76_/_.7)]" />
                  {f}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>
    </section>
  );
}
