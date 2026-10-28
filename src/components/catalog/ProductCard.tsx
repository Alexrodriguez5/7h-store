"use client";

import Image from "next/image";
import Link from "next/link";
import { memo, useState } from "react";
import { formatCOP } from "@/lib/format";
import { useCartStore } from "@/store/cart-store";
import { isSizeAvailable } from "@/lib/sizes";
import type { Product } from "@/types";

function ProductCardBase({ product, priority = false }: { product: Product; priority?: boolean }) {
  const addItem = useCartStore((s) => s.addItem);
  const [size, setSize] = useState<string | undefined>();

  const needsSize = !!product.sizes?.length;
  const soldOut = product.stock === 0;
  const discount =
    product.compareAtPriceCOP && product.compareAtPriceCOP > product.priceCOP
      ? Math.round((1 - product.priceCOP / product.compareAtPriceCOP) * 100)
      : 0;
  const href = `/producto/${product.slug}`;

  return (
    <article className="group flex h-full flex-col">
      {/* IMAGEN */}
      <Link
        href={href}
        className="relative block aspect-4/5 overflow-hidden rounded-2xl bg-ivory-200 shadow-soft transition-shadow duration-300 group-hover:shadow-lift"
        aria-label={`Ver ${product.name}`}
      >
        {product.images[0] && (
          <Image
            src={product.images[0]}
            alt={product.name}
            fill
            priority={priority}
            sizes="(min-width: 1024px) 25vw, (min-width: 640px) 33vw, 50vw"
            className={`object-cover transition-transform duration-700 ease-out group-hover:scale-[1.04] ${soldOut ? "opacity-60 grayscale-[.4]" : ""}`}
          />
        )}
        <div className="pointer-events-none absolute left-3 top-3 flex flex-col items-start gap-1.5">
          {soldOut ? (
            <span className="rounded-full bg-ink/85 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-ivory backdrop-blur">
              Agotado
            </span>
          ) : discount > 0 ? (
            <span className="rounded-full bg-gold px-2.5 py-1 text-[10px] font-semibold text-ink">
              -{discount}%
            </span>
          ) : null}
        </div>
      </Link>

      {/* INFORMACIÓN */}
      <div className="mt-4 flex flex-1 flex-col px-0.5">
        <p className="text-[11px] font-medium uppercase tracking-[.14em] text-ink-soft/70">
          {product.brand}
        </p>

        <h3 className="mt-1 min-h-13 font-display text-xl leading-snug">
          <Link href={href} className="transition-colors hover:text-gold">
            {product.name}
          </Link>
        </h3>

        <p className="mt-1 flex items-baseline gap-2">
          <span className="text-sm font-semibold">{formatCOP(product.priceCOP)}</span>
          {discount > 0 && (
            <del className="text-xs text-ink-soft/50">{formatCOP(product.compareAtPriceCOP!)}</del>
          )}
        </p>

        {/* TALLAS */}
        <div className="mt-3 min-h-9">
          {needsSize && (
            <div
              className="flex flex-wrap items-center gap-1.5"
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
                    className={`h-8 min-w-8 shrink-0 rounded-full border px-2.5 text-xs transition-colors ${
                      !available
                        ? "cursor-not-allowed border-ink/10 text-ink/30 line-through"
                        : isSelected
                          ? "border-ink bg-ink font-semibold text-ivory"
                          : "border-ink/15 text-ink hover:border-gold"
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
            onClick={() => addItem(product, size)}
            className={`w-full rounded-full py-2.5 text-sm font-medium transition-all duration-200 ${
              soldOut || (needsSize && !size)
                ? "cursor-not-allowed bg-ink/[.06] text-ink/45"
                : "bg-ink text-ivory hover:bg-gold hover:text-ink active:scale-[.98]"
            }`}
          >
            {soldOut
              ? "Agotado"
              : needsSize && !size
                ? "Elige una talla"
                : "Agregar al carrito"}
          </button>
        </div>
      </div>
    </article>
  );
}

/** Memorizada: al filtrar el catálogo solo se vuelven a dibujar las tarjetas que cambian. */
export const ProductCard = memo(ProductCardBase);
