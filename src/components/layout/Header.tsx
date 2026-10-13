"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { FormEvent, useState } from "react";
import { selectCount, useCartStore } from "@/store/cart-store";

import type { Category } from "@/types";

/** Las categorías vienen de la base de datos: una categoría nueva aparece aquí sin tocar código. */
export function Header({ categories }: { categories: Category[] }) {
  const NAV = [
    { label: "Todo", href: "/catalogo" },
    ...categories.map((c) => ({
      label: c.label,
      href: `/catalogo?categoria=${encodeURIComponent(c.slug)}`,
    })),
  ];
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();
  const [query, setQuery] = useState(searchParams.get("q") ?? "");
  const [mobile, setMobile] = useState(false);
  const open = useCartStore((s) => s.setOpen);
  const count = useCartStore(selectCount);
  const category = searchParams.get("categoria");

  const search = (e: FormEvent) => {
    e.preventDefault();
    const q = query.trim();
    router.push(q ? `/catalogo?q=${encodeURIComponent(q)}` : "/catalogo");
    setMobile(false);
  };

  const isActive = (href: string) => {
    if (pathname !== "/catalogo") return false;
    if (href === "/catalogo") return !category;
    return !!category && href.endsWith(`categoria=${encodeURIComponent(category)}`);
  };

  return (
    <>
      <div className="bg-gold px-4 py-2 text-center text-[10px] font-semibold tracking-wide text-ink sm:text-xs">
        Envío gratis a toda Colombia en compras desde $500.000 · Productos 100% originales de EE.UU.
      </div>

      <header className="sticky top-0 z-40 border-b border-white/10 bg-ink text-ivory">
        <div className="mx-auto flex max-w-7xl items-center gap-5 px-5 py-4 lg:px-8">
          <button
            className="lg:hidden"
            onClick={() => setMobile(true)}
            aria-label="Abrir menú"
            type="button"
          >
            ☰
          </button>

          <Link
            href="/"
            className="shrink-0 font-display text-3xl font-semibold tracking-widest text-gold-light"
            aria-label="7H STORE inicio"
          >
            7H STORE
          </Link>

          <nav
            className="hidden min-w-0 flex-wrap items-center gap-x-5 gap-y-1 lg:flex"
            aria-label="Principal"
          >
            {NAV.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={`border-b pb-1 text-xs transition-colors hover:text-gold-light ${
                  isActive(item.href) ? "border-gold text-gold-light" : "border-transparent"
                }`}
                aria-current={isActive(item.href) ? "page" : undefined}
              >
                {item.label}
              </Link>
            ))}
          </nav>

          <form onSubmit={search} className="ml-auto hidden max-w-sm flex-1 md:block" role="search">
            <label htmlFor="header-search" className="sr-only">
              Buscar productos
            </label>
            <div className="flex items-center border-b border-ivory/30">
              <input
                id="header-search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Buscar productos"
                className="w-full bg-transparent py-2 text-xs outline-none placeholder:text-ivory/50"
              />
              <button type="submit" className="px-1 text-xs text-gold-light hover:text-gold">
                Buscar
              </button>
            </div>
          </form>

          <Link href="/pedidos" className="hidden text-xs hover:text-gold-light sm:block">
            Mis pedidos
          </Link>

          <button
            onClick={() => open(true)}
            className="relative flex items-center gap-2 text-xs hover:text-gold-light"
            aria-label={`Carrito: ${count} productos`}
            type="button"
          >
            <span aria-hidden="true">◯</span>
            <span className="hidden sm:inline">Carrito</span>
            <span className="min-w-5 border border-gold px-1 text-center text-[10px] text-gold-light">
              {count}
            </span>
          </button>
        </div>

        {mobile && (
          <div className="fixed inset-0 z-50 bg-ink p-6 lg:hidden">
            <div className="flex items-center justify-between">
              <span className="font-display text-3xl text-gold-light">7H STORE</span>
              <button onClick={() => setMobile(false)} aria-label="Cerrar menú" type="button">
                ✕
              </button>
            </div>

            <form onSubmit={search} className="mt-8 flex border-b border-ivory/30" role="search">
              <label htmlFor="mobile-search" className="sr-only">
                Buscar productos
              </label>
              <input
                id="mobile-search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Buscar productos"
                className="w-full bg-transparent py-3 text-sm outline-none"
              />
              <button type="submit" className="text-gold-light">
                Buscar
              </button>
            </form>

            <nav className="mt-8 flex flex-col gap-5" aria-label="Menú móvil">
              {NAV.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMobile(false)}
                  className="font-display text-3xl"
                >
                  {item.label}
                </Link>
              ))}
              <Link
                href="/pedidos"
                onClick={() => setMobile(false)}
                className="font-display text-3xl"
              >
                Mis pedidos
              </Link>
            </nav>
          </div>
        )}
      </header>
    </>
  );
}
