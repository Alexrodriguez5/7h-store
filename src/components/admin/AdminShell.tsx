"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";
import { adminFetch } from "./api";

const NAV = [
  { href: "/admin", label: "Dashboard", exact: true },
  { href: "/admin/pedidos", label: "Pedidos" },
  { href: "/admin/productos", label: "Productos" },
  { href: "/admin/categorias", label: "Categorías" },
  { href: "/admin/inventario", label: "Inventario" },
  { href: "/admin/configuracion", label: "Configuración" },
];

export function AdminShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const active = (href: string, exact?: boolean) => (exact ? pathname === href : pathname.startsWith(href));

  const logout = async () => {
    await adminFetch("/api/admin/logout", "POST");
    router.replace("/admin/login");
    router.refresh();
  };

  const nav = (
    <nav aria-label="Administración" className="flex flex-1 flex-col gap-1 p-4">
      {NAV.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          onClick={() => setOpen(false)}
          aria-current={active(item.href, item.exact) ? "page" : undefined}
          className={`border-l-2 px-3 py-2.5 text-sm transition-colors ${active(item.href, item.exact) ? "border-gold bg-white/5 text-gold-light" : "border-transparent text-ivory/70 hover:text-ivory"}`}
        >
          {item.label}
        </Link>
      ))}
      <div className="mt-auto space-y-2 border-t border-white/10 pt-4">
        <Link href="/" target="_blank" className="block px-3 py-2 text-xs text-ivory/60 hover:text-ivory">Ver tienda ↗</Link>
        <button type="button" onClick={logout} className="w-full px-3 py-2 text-left text-xs text-ivory/60 hover:text-ivory">Cerrar sesión</button>
      </div>
    </nav>
  );

  return (
    <div id="contenido" className="min-h-screen bg-ivory lg:grid lg:grid-cols-[240px_1fr]">
      <aside className="sticky top-0 hidden h-screen flex-col bg-ink text-ivory lg:flex">
        <div className="border-b border-white/10 p-6">
          <p className="font-display text-2xl font-semibold tracking-widest text-gold-light">7H STORE</p>
          <p className="mt-1 text-[10px] uppercase tracking-[0.25em] text-ivory/50">Administración</p>
        </div>
        {nav}
      </aside>

      <header className="sticky top-0 z-30 flex items-center justify-between bg-ink px-5 py-3 text-ivory lg:hidden">
        <p className="font-display text-xl font-semibold tracking-widest text-gold-light">7H ADMIN</p>
        <button type="button" onClick={() => setOpen(true)} aria-label="Abrir menú" className="px-2 text-xl">☰</button>
      </header>
      {open && (
        <div className="fixed inset-0 z-40 lg:hidden" role="dialog" aria-modal="true" aria-label="Menú de administración">
          <button type="button" aria-label="Cerrar menú" className="absolute inset-0 bg-black/60" onClick={() => setOpen(false)} />
          <div className="relative flex h-full w-72 flex-col bg-ink text-ivory">
            <div className="flex items-center justify-between border-b border-white/10 p-5">
              <p className="font-display text-xl font-semibold tracking-widest text-gold-light">7H ADMIN</p>
              <button type="button" onClick={() => setOpen(false)} aria-label="Cerrar">✕</button>
            </div>
            {nav}
          </div>
        </div>
      )}

      <main className="min-w-0 px-5 py-8 lg:px-10 lg:py-10">{children}</main>
    </div>
  );
}
