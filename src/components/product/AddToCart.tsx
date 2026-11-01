"use client";

import { useState } from "react";
import { useCartStore } from "@/store/cart-store";
import type { Product } from "@/types";
import { Button } from "@/components/ui/Button";
import { Toast } from "@/components/ui/Toast";
import { isSizeAvailable, stockForSize } from "@/lib/sizes";
import { MinusIcon, PlusIcon } from "@/components/ui/Icons";

export function AddToCart({ product }: { product: Product }) {
  const [size, setSize] = useState<string>();
  const [qty, setQty] = useState(1);
  const [toast, setToast] = useState<string | null>(null);
  const add = useCartStore((s) => s.addItem);
  const inCart = useCartStore((s) => s.items.find((i) => i.key === `${product.id}:${size ?? "u"}`)?.quantity ?? 0);
  const needs = !!product.sizes?.length;
  const sold = product.stock <= 0;
  // Unidades que todavía se pueden agregar (stock de la talla elegida menos lo que ya está en el carrito).
  const available = needs && !size ? 0 : Math.max(0, stockForSize(product, size) - inCart);
  const max = Math.min(available, 20);
  const quantity = Math.min(qty, Math.max(max, 1));

  return (
    <div className="space-y-5">
      {needs && (
        <div>
          <p className="mb-3 text-xs font-semibold uppercase tracking-widest">
            Talla {size && <span className="font-normal normal-case tracking-normal text-ink-soft">· {size}</span>}
          </p>
          <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Seleccionar talla">
            {product.sizes?.map((s) => {
              const ok = isSizeAvailable(product, s);
              return (
                <button
                  type="button"
                  key={s}
                  role="radio"
                  aria-checked={size === s}
                  aria-disabled={!ok}
                  disabled={!ok}
                  title={ok ? undefined : "Talla agotada"}
                  onClick={() => {
                    setSize(s);
                    setQty(1);
                  }}
                  className={`min-h-11 min-w-12 rounded-full border px-4 py-2.5 text-xs font-medium transition-colors ${
                    !ok
                      ? "cursor-not-allowed border-ink/10 text-ink/30 line-through"
                      : size === s
                        ? "border-ink bg-ink text-ivory"
                        : "border-ink/15 hover:border-gold"
                  }`}
                >
                  {s}
                </button>
              );
            })}
          </div>
        </div>
      )}

      <div className="flex items-stretch gap-3">
        <div className="flex items-center rounded-full border border-ink/15 bg-white/60" role="group" aria-label="Cantidad">
          <button
            type="button"
            onClick={() => setQty((q) => Math.max(1, q - 1))}
            disabled={quantity <= 1}
            className="grid size-12 place-items-center rounded-full transition-colors hover:bg-ink/5 disabled:opacity-30"
            aria-label="Disminuir cantidad"
          >
            <MinusIcon width={16} height={16} />
          </button>
          <span className="w-8 text-center text-sm font-semibold" aria-live="polite" aria-label={`Cantidad: ${quantity}`}>
            {quantity}
          </span>
          <button
            type="button"
            onClick={() => setQty((q) => Math.min(max, q + 1))}
            disabled={quantity >= max}
            className="grid size-12 place-items-center rounded-full transition-colors hover:bg-ink/5 disabled:opacity-30"
            aria-label="Aumentar cantidad"
          >
            <PlusIcon width={16} height={16} />
          </button>
        </div>
        <Button
          variant="primary"
          className="flex-1 py-4"
          disabled={sold || (needs && !size) || available <= 0}
          onClick={() => {
            add(product, size, quantity);
            setQty(1);
            setToast(quantity > 1 ? `${quantity} unidades agregadas al carrito` : "Agregado al carrito");
          }}
        >
          {sold ? "Agotado" : needs && !size ? "Elige una talla" : available <= 0 ? "Máximo en tu carrito" : "Agregar al carrito"}
        </Button>
      </div>
      <p className="text-xs leading-6 text-ink-soft">Producto original · Envío a toda Colombia · Seguimiento de tu pedido</p>
      <Toast message={toast} onClose={() => setToast(null)} />
    </div>
  );
}
