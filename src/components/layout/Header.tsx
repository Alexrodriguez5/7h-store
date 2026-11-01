"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";
import { selectCount, useCartStore } from "@/store/cart-store";
import { BagIcon, CloseIcon, MenuIcon, SearchIcon } from "@/components/ui/Icons";

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

  // Con el menú móvil abierto: la página de fondo no se desplaza y Escape lo cierra.
  useEffect(() => {
    if (!mobile) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setMobile(false);
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [mobile]);

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

      <header className="sticky top-0 z-40 border-b border-white/10 bg-ink/90 text-ivory backdrop-blur-md supports-[backdrop-filter]:bg-ink/80">
        <div className="mx-auto flex max-w-7xl items-center gap-4 px-5 py-3.5 lg:gap-6 lg:px-8">
          <button
            className="-ml-2 grid size-10 place-items-center rounded-full transition-colors hover:bg-white/10 lg:hidden"
            onClick={() => setMobile(true)}
            aria-label="Abrir menú"
            aria-expanded={mobile}
            type="button"
          >
            <MenuIcon width={22} height={22} />
          </button>

          <Link
            href="/"
            className="shrink-0 font-display text-[28px] font-semibold tracking-[.18em] text-gold-light transition-opacity hover:opacity-85"
            aria-label="7H STORE inicio"
          >
            7H STORE
          </Link>

          <nav
            className="hidden min-w-0 flex-wrap items-center gap-1 lg:flex"
            aria-label="Principal"
          >
            {NAV.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={`whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                  isActive(item.href)
                    ? "bg-gold/15 text-gold-light"
                    : "text-ivory/80 hover:bg-white/5 hover:text-gold-light"
                }`}
                aria-current={isActive(item.href) ? "page" : undefined}
              >
                {item.label}
              </Link>
            ))}
          </nav>

          <form onSubmit={search} className="ml-auto hidden min-w-36 max-w-xs flex-1 md:block" role="search">
            <label htmlFor="header-search" className="sr-only">
              Buscar productos
            </label>
            <div className="group flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3.5 transition-colors focus-within:border-gold/70 focus-within:bg-white/10">
              <SearchIcon width={16} height={16} className="shrink-0 text-ivory/50 group-focus-within:text-gold-light" />
              <input
                id="header-search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Buscar productos"
                className="w-full bg-transparent py-2 text-xs outline-none placeholder:text-ivory/45"
              />
              <button type="submit" className="text-xs font-medium text-gold-light hover:text-gold">
                Buscar
              </button>
            </div>
          </form>

          <Link
            href="/cuenta"
            className="ml-auto hidden shrink-0 whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-medium text-ivory/80 transition-colors hover:bg-white/5 hover:text-gold-light sm:block md:ml-0"
          >
            Mi cuenta
          </Link>

          <button
            onClick={() => open(true)}
            className="relative ml-auto flex shrink-0 items-center gap-2 rounded-full border border-white/15 py-2 pl-3 pr-2 text-xs font-medium transition-colors hover:border-gold/70 hover:text-gold-light sm:ml-0"
            aria-label={`Carrito: ${count} productos`}
            type="button"
          >
            <BagIcon width={18} height={18} />
            <span className="hidden sm:inline">Carrito</span>
            <span
              className={`grid h-5 min-w-5 place-items-center rounded-full px-1.5 text-[10px] font-semibold transition-colors ${
                count > 0 ? "bg-gold text-ink" : "bg-white/10 text-ivory/70"
              }`}
            >
              {count}
            </span>
          </button>
        </div>
      </header>

      {mobile && (
        <div
          className="fixed inset-0 z-50 flex flex-col overflow-y-auto bg-ink p-6 text-ivory animate-fade-up lg:hidden"
          role="dialog"
          aria-modal="true"
          aria-label="Menú"
        >
          <div className="flex items-center justify-between">
            <span className="font-display text-3xl tracking-[.18em] text-gold-light">7H STORE</span>
            <button
              onClick={() => setMobile(false)}
              aria-label="Cerrar menú"
              type="button"
              className="grid size-10 place-items-center rounded-full transition-colors hover:bg-white/10"
            >
              <CloseIcon width={22} height={22} />
            </button>
          </div>

          <form
            onSubmit={search}
            className="mt-8 flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-4 focus-within:border-gold/70"
            role="search"
          >
            <label htmlFor="mobile-search" className="sr-only">
              Buscar productos
            </label>
            <SearchIcon width={18} height={18} className="shrink-0 text-ivory/50" />
            <input
              id="mobile-search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar productos"
              className="w-full bg-transparent py-3 text-sm outline-none placeholder:text-ivory/45"
            />
            <button type="submit" className="text-sm font-medium text-gold-light">
              Buscar
            </button>
          </form>

          <nav className="mt-8 flex flex-col divide-y divide-white/10" aria-label="Menú móvil">
            {NAV.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMobile(false)}
                className={`py-4 font-display text-3xl transition-colors hover:text-gold-light ${
                  isActive(item.href) ? "text-gold-light" : ""
                }`}
              >
                {item.label}
              </Link>
            ))}
            <Link
              href="/cuenta"
              onClick={() => setMobile(false)}
              className="py-4 font-display text-3xl transition-colors hover:text-gold-light"
            >
              Mi cuenta
            </Link>
          </nav>
        </div>
      )}
    </>
  );
}
