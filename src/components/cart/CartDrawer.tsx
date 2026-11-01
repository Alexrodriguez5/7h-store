"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect } from "react";
import { formatCOP } from "@/lib/format";
import { amountToFreeShipping, FREE_SHIPPING_THRESHOLD } from "@/lib/shipping";
import { selectSubtotal, useCartStore } from "@/store/cart-store";
import { BagIcon, CloseIcon, MinusIcon, PlusIcon } from "@/components/ui/Icons";

export function CartDrawer() {
  // Selectores individuales: el carrito solo se vuelve a dibujar cuando cambia lo que muestra.
  const items = useCartStore((s) => s.items);
  const isOpen = useCartStore((s) => s.isOpen);
  const setOpen = useCartStore((s) => s.setOpen);
  const setQuantity = useCartStore((s) => s.setQuantity);
  const removeItem = useCartStore((s) => s.removeItem);
  const subtotal = useCartStore(selectSubtotal);
  const missing = amountToFreeShipping(subtotal);
  const progress = Math.min(100, Math.round((subtotal / FREE_SHIPPING_THRESHOLD) * 100));

  // Escape cierra el carrito y la página de fondo no se desplaza mientras está abierto.
  useEffect(() => {
    if (!isOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [isOpen, setOpen]);

  return (
    <>
      <div
        className={`fixed inset-0 z-40 bg-black/40 backdrop-blur-[2px] transition-opacity duration-300 ${isOpen ? "opacity-100" : "pointer-events-none opacity-0"}`}
        onClick={() => setOpen(false)}
        aria-hidden="true"
      />
      <aside
        aria-label="Carrito de compras"
        aria-hidden={!isOpen}
        inert={!isOpen}
        className={`fixed right-0 top-0 z-50 flex h-full w-full max-w-md flex-col bg-ivory shadow-2xl transition-transform duration-300 ease-out ${isOpen ? "translate-x-0" : "translate-x-full"}`}
      >
        <header className="flex items-center justify-between border-b border-ink/10 px-5 py-4">
          <h2 className="flex items-center gap-2 font-display text-2xl">
            Tu carrito
            {items.length > 0 && (
              <span className="rounded-full bg-ink/[.06] px-2 py-0.5 font-sans text-xs font-medium text-ink-soft">
                {items.reduce((n, i) => n + i.quantity, 0)}
              </span>
            )}
          </h2>
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label="Cerrar carrito"
            className="grid size-10 place-items-center rounded-full transition-colors hover:bg-ink/5"
          >
            <CloseIcon />
          </button>
        </header>

        <ul className="flex-1 divide-y divide-ink/10 overflow-y-auto overscroll-contain px-5">
          {items.length === 0 ? (
            <li className="flex flex-col items-center py-16 text-center">
              <span className="grid size-16 place-items-center rounded-full bg-ink/[.05] text-ink-soft">
                <BagIcon width={28} height={28} />
              </span>
              <p className="mt-5 font-display text-2xl">Tu carrito está vacío.</p>
              <Link
                href="/catalogo"
                onClick={() => setOpen(false)}
                className="mt-5 inline-block rounded-full bg-ink px-5 py-2.5 text-xs font-semibold text-ivory transition-colors hover:bg-gold hover:text-ink"
              >
                Ver catálogo
              </Link>
            </li>
          ) : (
            items.map((i) => (
              <li key={i.key} className="py-5">
                <div className="flex gap-4">
                  <div className="relative h-24 w-20 shrink-0 overflow-hidden rounded-xl bg-ivory-200">
                    {i.image && (
                      <Image src={i.image} alt="" fill sizes="80px" className="object-cover" />
                    )}
                  </div>
                  <div className="flex min-w-0 flex-1 flex-col">
                    <div className="flex items-start justify-between gap-3">
                      <p className="font-display text-lg leading-tight">{i.name}</p>
                      <button
                        type="button"
                        onClick={() => removeItem(i.key)}
                        className="shrink-0 text-xs text-ink-soft underline underline-offset-4 transition-colors hover:text-error"
                      >
                        Quitar
                      </button>
                    </div>
                    {i.size && <p className="mt-1 text-xs text-ink-soft">Talla {i.size}</p>}
                    <p className="mt-1 text-sm font-semibold">{formatCOP(i.priceCOP)}</p>
                    <div className="mt-auto flex flex-wrap items-center justify-between gap-2 pt-2">
                      <div className="flex items-center rounded-full border border-ink/15 bg-white/50">
                        <button
                          type="button"
                          onClick={() => setQuantity(i.key, i.quantity - 1)}
                          className="grid size-8 place-items-center rounded-full transition-colors hover:bg-ink/5"
                          aria-label="Disminuir cantidad"
                        >
                          <MinusIcon width={14} height={14} />
                        </button>
                        <span className="w-8 text-center text-xs font-semibold">{i.quantity}</span>
                        <button
                          type="button"
                          onClick={() => setQuantity(i.key, i.quantity + 1)}
                          className="grid size-8 place-items-center rounded-full transition-colors hover:bg-ink/5 disabled:opacity-30 disabled:hover:bg-transparent"
                          disabled={i.quantity >= i.stock}
                          aria-label="Aumentar cantidad"
                        >
                          <PlusIcon width={14} height={14} />
                        </button>
                      </div>
                      {i.quantity >= i.stock && (
                        <span className="text-[10px] text-warning">Límite de stock alcanzado</span>
                      )}
                    </div>
                  </div>
                </div>
              </li>
            ))
          )}
        </ul>

        {/* Con el carrito vacío no se muestra envío ni total: no hay nada que cobrar. */}
        {items.length > 0 && (
          <footer className="space-y-3 border-t border-ink/10 bg-white/40 p-5">
            <div>
              <div className="text-xs text-ink-soft">
                {missing > 0 ? `Te faltan ${formatCOP(missing)} para envío gratis.` : "¡Tienes envío gratis!"}
              </div>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-ink/[.07]" aria-hidden="true">
                <div className="h-full rounded-full bg-gold transition-[width] duration-500" style={{ width: `${progress}%` }} />
              </div>
            </div>
            <div className="flex justify-between text-sm">
              <span>Subtotal</span>
              <strong>{formatCOP(subtotal)}</strong>
            </div>
            <div className="flex justify-between gap-4 text-sm">
              <span>Envío</span>
              <span className="text-right">{missing === 0 ? "Gratis" : "Se calcula en el pago según tu ciudad"}</span>
            </div>
            <div className="flex justify-between border-t border-ink/10 pt-3 font-semibold">
              <span>{missing === 0 ? "Total" : "Total sin envío"}</span>
              <span>{formatCOP(subtotal)}</span>
            </div>
            <Link
              href="/checkout"
              onClick={() => setOpen(false)}
              className="block rounded-full bg-ink py-3.5 text-center text-sm font-semibold text-ivory shadow-soft transition-colors hover:bg-gold hover:text-ink"
            >
              Ir a pagar
            </Link>
          </footer>
        )}
      </aside>
    </>
  );
}
