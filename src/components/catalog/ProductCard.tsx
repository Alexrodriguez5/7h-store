"use client";

import Image from "next/image";
import { Tilt } from "@/components/home/Motion";
import Link from "next/link";
import { memo, useEffect, useState } from "react";
import { formatCOP } from "@/lib/format";
import { useCartStore } from "@/store/cart-store";
import { isSizeAvailable } from "@/lib/sizes";
import type { Product } from "@/types";
import { BADGE_TONE_CLS, productBadges } from "@/lib/badges";

function ProductCardBase({ product, priority = false }: { product: Product; priority?: boolean }) {
  const addItem = useCartStore((s) => s.addItem);
  const [size, setSize] = useState<string | undefined>();
  const [added, setAdded] = useState(false);
  useEffect(() => {
    if (!added) return;
    const t = setTimeout(() => setAdded(false), 1600);
    return () => clearTimeout(t);
  }, [added]);

  const needsSize = !!product.sizes?.length;
  const soldOut = product.stock === 0;
  const discount =
    product.compareAtPriceCOP && product.compareAtPriceCOP > product.priceCOP
      ? Math.round((1 - product.priceCOP / product.compareAtPriceCOP) * 100)
      : 0;
  const href = `/producto/${product.slug}`;
  // En la tarjeta solo caben 2 etiquetas; el resto se ve en la ficha.
  const badges = productBadges(product).filter((b) => b.key !== "ULTIMAS").slice(0, 2);

  return (
    <article className="group isolate flex h-full flex-col">
      {/* IMAGEN (inclinación 3D al pasar el cursor) */}
      {/* Profundidad: sombra ambiental dorada debajo, inclinación con brillo y un reflejo que cruza la foto */}
      <Tilt className="ambient rounded-[24px]">
      <Link
        href={href}
        className="sheen relative block aspect-4/5 overflow-hidden rounded-[24px] bg-gradient-to-b from-white to-ivory-200 shadow-soft ring-1 ring-ink/[.05] transition-[box-shadow,transform] duration-300 group-hover:shadow-lift active:scale-[.985] sm:active:scale-100"
        aria-label={`Ver ${product.name}`}
      >
        {product.images[0] && (
          <Image
            src={product.images[0]}
            alt={product.name}
            fill
            priority={priority}
            sizes="(min-width: 1024px) 25vw, (min-width: 640px) 33vw, 50vw"
            className={`object-cover transition-[transform,opacity] duration-700 ease-out group-hover:scale-[1.06] ${product.images[1] ? "sm:group-hover:opacity-0" : ""} ${soldOut ? "opacity-60 grayscale-[.4]" : ""}`}
          />
        )}
        {/* Segunda foto al pasar el cursor (solo con mouse; en celular se mantiene la principal). */}
        {product.images[1] && !soldOut && (
          <Image
            src={product.images[1]}
            alt=""
            aria-hidden="true"
            fill
            loading="lazy"
            sizes="(min-width: 1024px) 25vw, (min-width: 640px) 33vw, 50vw"
            className="hidden scale-[1.04] object-cover opacity-0 transition-[transform,opacity] duration-700 ease-out sm:block sm:group-hover:scale-100 sm:group-hover:opacity-100"
          />
        )}
        <div className="pointer-events-none absolute left-3 top-3 flex flex-col items-start gap-1.5">
          {badges.map((b) => (
            <span key={b.key} className={`rounded-full px-2.5 py-1 text-[10px] font-semibold tracking-wide shadow-soft ${BADGE_TONE_CLS[b.tone]}`}>
              {b.label}
            </span>
          ))}
        </div>
        {/* Llamado al pasar el cursor (solo computador) */}
        <span aria-hidden="true" className="glass pointer-events-none absolute inset-x-3 bottom-3 hidden translate-y-3 rounded-full py-2 text-center text-xs font-semibold text-ink opacity-0 transition-all duration-300 group-hover:translate-y-0 group-hover:opacity-100 sm:block">
          Ver producto
        </span>
      </Link>
      </Tilt>

      {/* INFORMACIÓN */}
      <div className="mt-4 flex flex-1 flex-col px-0.5">
        <p className="text-[11px] font-medium uppercase tracking-[.14em] text-ink-soft/70">
          {product.brand}
        </p>

        <h3 className="mt-1 line-clamp-2 min-h-13 font-display text-[22px] leading-[1.1]">
          <Link href={href} className="transition-colors hover:text-gold">
            {product.name}
          </Link>
        </h3>

        <p className="mt-1.5 flex items-center gap-1.5 text-[11px] font-medium text-ink-soft">
          <span aria-hidden="true" className={`size-1.5 rounded-full ${soldOut ? "bg-error" : product.stock <= 3 ? "bg-warning" : "bg-success"}`} />
          {soldOut ? "Agotado" : product.stock <= 3 ? `Últimas ${product.stock} unidades` : "Disponible"}
        </p>

        <p className="mt-1 flex items-baseline gap-2">
          <span className="text-base font-semibold tabular-nums">{formatCOP(product.priceCOP)}</span>
          {discount > 0 && (
            <del className="text-xs text-ink-soft/50">{formatCOP(product.compareAtPriceCOP!)}</del>
          )}
        </p>

        {/* TALLAS */}
        <div className="mt-3 min-h-9">
          {needsSize && (
            <div
              className="no-scrollbar -mx-0.5 flex items-center gap-1.5 overflow-x-auto px-0.5 pb-0.5"
              role="radiogroup"
              aria-label={`Seleccionar talla para ${product.name}`}
            >
              {product.sizes!.map((s) => {
                const isSelected = size === s;
                const available = isSizeAvailable(product, s);

                return (
                  <button
                    key={s}
                    type="button"
                    role="radio"
                    aria-checked={isSelected}
                    aria-disabled={!available}
                    disabled={!available}
                    title={available ? undefined : "Talla agotada"}
                    onClick={() => setSize(s)}
                    className={`h-9 min-w-9 shrink-0 rounded-full border px-2.5 text-xs transition-all duration-200 ${
                      !available
                        ? "cursor-not-allowed border-ink/10 text-ink/30 line-through"
                        : isSelected
                          ? "otp-pop border-gold bg-ink font-semibold text-gold-light shadow-[0_0_0_3px_rgb(201_164_76_/_.22)]"
                          : "border-ink/15 bg-white/60 text-ink hover:-translate-y-px hover:border-gold"
                    }`}
                  >
                    {s}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* BOTÓN */}
        <div className="mt-auto pt-3">
          <button
            type="button"
            disabled={soldOut || (needsSize && !size)}
            onClick={() => { addItem(product, size); setAdded(true); }}
            className={`w-full rounded-full py-2.5 text-sm font-medium transition-all duration-200 ${
              soldOut || (needsSize && !size)
                ? "cursor-not-allowed bg-ink/[.06] text-ink/45"
                : added
                  ? "bg-gold text-ink"
                  : "btn-shine bg-ink text-ivory shadow-soft hover:bg-gold hover:text-ink hover:shadow-lift active:scale-[.98]"
            }`}
          >
            {soldOut ? (
              "Agotado"
            ) : needsSize && !size ? (
              "Elige una talla"
            ) : added ? (
              <span key="ok" className="added-in inline-flex items-center gap-1.5">
                <svg aria-hidden="true" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path className="draw-check" d="M5 12.5l4.5 4.5L19 7.5" /></svg>
                Agregado
              </span>
            ) : (
              "Agregar al carrito"
            )}
          </button>
        </div>
      </div>
    </article>
  );
}

/** Memorizada: al filtrar el catálogo solo se vuelven a dibujar las tarjetas que cambian. */
export const ProductCard = memo(ProductCardBase);
