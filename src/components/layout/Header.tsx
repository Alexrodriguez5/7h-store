"use client";

import Link from "next/link";
import { Logo } from "@/components/brand/Logo";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";
import { selectCount, selectSubtotal, useCartStore } from "@/store/cart-store";
import { amountToFreeShipping, FREE_SHIPPING_THRESHOLD } from "@/lib/shipping";
import { formatCOP } from "@/lib/format";
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
  const subtotal = useCartStore(selectSubtotal);
  // El carrito vive en el navegador: el aviso personalizado solo se muestra después de montar (evita diferencias con el HTML del servidor).
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const missing = amountToFreeShipping(subtotal);
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
        {mounted && subtotal > 0 ? (
          missing > 0 ? (
            <span>Te faltan <strong>{formatCOP(missing)}</strong> para tu envío gratis · Agrega algo más y ahorra el envío</span>
          ) : (
            <span>¡Listo! Tu pedido tiene <strong>envío gratis</strong> a toda Colombia</span>
          )
        ) : (
          <>Envío gratis a toda Colombia en compras desde {formatCOP(FREE_SHIPPING_THRESHOLD)} · Productos 100% originales de EE.UU.</>
        )}
      </div>

      <header data-nosnippet className="sticky top-0 z-40 border-b border-white/[.07] bg-ink/95 text-ivory shadow-[inset_0_-1px_0_rgb(216_184_102_/_.12)] backdrop-blur-xl backdrop-saturate-150 supports-[backdrop-filter]:bg-ink/90">
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
            className="flex shrink-0 items-center transition-opacity hover:opacity-85"
            aria-label="7H STORE inicio"
          >
            <Logo />
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
            <div className="group flex h-9 items-center gap-2 rounded-full border border-gold/35 bg-transparent pl-3.5 pr-1 transition-colors hover:border-gold/55 focus-within:border-gold-light">
              <SearchIcon width={16} height={16} className="shrink-0 text-ivory/50 group-focus-within:text-gold-light" />
              <input
                id="header-search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Buscar productos"
                className="h-full w-full min-w-0 rounded-none border-0 bg-transparent p-0 text-xs text-ivory shadow-none outline-none ring-0 placeholder:text-ivory/45 focus:outline-none focus-visible:outline-none"
              />
              <button type="submit" className="h-7 shrink-0 rounded-full px-3 text-xs font-medium text-gold-light outline-none transition-colors hover:bg-gold/10 focus-visible:bg-gold/15">
                Buscar
              </button>
            </div>
          </form>

          <Link
            href="/tu-lo-buscas"
            className={`hidden shrink-0 whitespace-nowrap rounded-full border px-3 py-1.5 text-xs font-medium transition-colors xl:block ${isActive("/tu-lo-buscas") ? "border-gold text-gold-light" : "border-gold/40 text-gold-light hover:border-gold hover:bg-gold/10"}`}
          >
            Tú lo buscas
          </Link>

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
            className="mt-8 flex h-12 items-center gap-2 rounded-full border border-gold/35 bg-transparent pl-4 pr-1.5 transition-colors focus-within:border-gold-light"
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
              className="h-full w-full min-w-0 rounded-none border-0 bg-transparent p-0 text-base text-ivory shadow-none outline-none ring-0 placeholder:text-ivory/45 focus:outline-none focus-visible:outline-none"
            />
            <button type="submit" className="h-9 shrink-0 rounded-full px-4 text-sm font-medium text-gold-light outline-none hover:bg-gold/10 focus-visible:bg-gold/15">
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
          <nav className="mt-6 grid grid-cols-2 gap-2 text-sm" aria-label="Más de 7H">
            {[["/tu-lo-buscas", "Tú lo buscas"], ["/comunidad", "Comunidad 7H"], ["/asi-se-vive-7h", "Así se vive 7H"], ["/habla-con-7h", "Habla con 7H"]].map(([href, label]) => (
              <Link key={href} href={href} onClick={() => setMobile(false)} className="rounded-2xl border border-white/10 px-4 py-3 text-ivory/85 transition-colors hover:border-gold/60 hover:text-gold-light">
                {label}
              </Link>
            ))}
          </nav>
        </div>
      )}
    </>
  );
}
