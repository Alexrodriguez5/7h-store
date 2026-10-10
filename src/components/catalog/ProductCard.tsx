"use client";

import Image from "next/image";
import { useState } from "react";
import { formatCOP } from "@/lib/format";
import { useCartStore } from "@/store/cart-store";
import { isSizeAvailable } from "@/lib/sizes";
import type { Product } from "@/types";

export function ProductCard({ product }: { product: Product }) {
  const addItem = useCartStore((s) => s.addItem);
  const [size, setSize] = useState<string | undefined>();

  const needsSize = !!product.sizes?.length;
  const soldOut = product.stock === 0;

  return (
    <article className="group flex h-full flex-col">
      {/* IMAGEN */}
      <div className="relative aspect-4/5 overflow-hidden rounded-sm bg-ivory-200">
        <Image
          src={product.images[0]}
          alt={product.name}
          fill
          sizes="(min-width: 1024px) 25vw, (min-width: 640px) 33vw, 50vw"
          className="object-cover transition-transform duration-500 group-hover:scale-[1.03]"
        />
      </div>

      {/* INFORMACIÓN */}
      <div className="mt-4 flex flex-1 flex-col">
        {/* MARCA */}
        <p className="text-xs text-ink-soft">
          {product.brand}
        </p>

        {/* NOMBRE */}
        <h3 className="min-h-13 font-display text-xl leading-snug">
          {product.name}
        </h3>

        {/* PRECIO */}
        <p className="text-sm font-semibold">
          {formatCOP(product.priceCOP)}
        </p>

        {/* TALLAS */}
        <div className="mt-3 h-9">
          {needsSize && (
            <div
              className="flex h-9 flex-nowrap items-center gap-1"
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
                    className={`relative h-8 min-w-7 px-1 text-xs transition-all ${
                      !available
                        ? "cursor-not-allowed text-ink/30 line-through"
                        : isSelected
                          ? "font-bold text-ink"
                          : "text-ink hover:font-semibold"
                    }`}
                  >
                    {s}

                    {isSelected && (
                      <span
                        aria-hidden="true"
                        className="absolute bottom-0 left-1/2 h-0.5 w-4 -translate-x-1/2 bg-ink"
                      />
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* BOTÓN */}
        <div className="mt-3 min-h-10.5">
          <button
            type="button"
            disabled={soldOut || (needsSize && !size)}
            onClick={() => addItem(product, size)}
            className={`w-full border py-2.5 text-sm font-medium transition-colors ${
              soldOut
                ? "cursor-not-allowed border-ink bg-ink text-ivory/50"
                : needsSize && !size
                  ? "cursor-not-allowed border-ink bg-ink text-ivory/60"
                  : "border-ink bg-ink text-ivory hover:bg-gold hover:text-ink"
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