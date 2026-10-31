"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";
import { adminFetch } from "./api";
import { CloseIcon, MenuIcon } from "@/components/ui/Icons";

const NAV: { href: string; label: string; exact?: boolean; owner?: boolean }[] = [
  { href: "/admin", label: "Dashboard", exact: true },
  { href: "/admin/pedidos", label: "Pedidos" },
  { href: "/admin/productos", label: "Productos" },
  { href: "/admin/categorias", label: "Categorías" },
  { href: "/admin/inventario", label: "Inventario" },
  { href: "/admin/envios", label: "Envíos" },
  { href: "/admin/usuarios", label: "Usuarios", owner: true },
  { href: "/admin/auditoria", label: "Auditoría" },
  { href: "/admin/configuracion", label: "Configuración" },
];

export interface ShellAdmin { name: string; email: string; role: "OWNER" | "ADMIN" }

export function AdminShell({ children, admin }: { children: ReactNode; admin: ShellAdmin }) {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const active = (href: string, exact?: boolean) => (exact ? pathname === href : pathname.startsWith(href));

  const [leaving, setLeaving] = useState(false);
  const logout = async () => {
    if (leaving) return;
    setLeaving(true);
    await adminFetch("/api/admin/logout", "POST");
    router.replace("/admin/login");
    router.refresh();
  };

  const nav = (
    <nav aria-label="Administración" className="flex flex-1 flex-col gap-1 p-4">
      {NAV.filter((item) => !item.owner || admin.role === "OWNER").map((item) => (
        <Link
          key={item.href}
          href={item.href}
          onClick={() => setOpen(false)}
          aria-current={active(item.href, item.exact) ? "page" : undefined}
          className={`rounded-xl px-3.5 py-2.5 text-sm transition-colors ${active(item.href, item.exact) ? "bg-gold/15 font-medium text-gold-light" : "text-ivory/70 hover:bg-white/5 hover:text-ivory"}`}
        >
          {item.label}
        </Link>
      ))}
      <div className="mt-auto space-y-2 border-t border-white/10 pt-4">
        <Link href="/admin/cuenta" onClick={() => setOpen(false)} aria-current={active("/admin/cuenta") ? "page" : undefined} className="block px-3 py-2 text-xs text-ivory/70 hover:text-ivory">
          <span className="block truncate font-semibold text-ivory">{admin.name}</span>
          <span className="block truncate text-[11px] text-ivory/60">{admin.role === "OWNER" ? "Dueño" : "Administrador"} · Mi cuenta</span>
        </Link>
        <Link href="/" target="_blank" className="block px-3 py-2 text-xs text-ivory/60 hover:text-ivory">Ver tienda ↗</Link>
        <button type="button" onClick={logout} disabled={leaving} className="w-full px-3 py-2 text-left text-xs text-ivory/60 hover:text-ivory disabled:opacity-50">{leaving ? "Cerrando…" : "Cerrar sesión"}</button>
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
        <button type="button" onClick={() => setOpen(true)} aria-label="Abrir menú" className="grid size-10 place-items-center rounded-full hover:bg-white/10"><MenuIcon /></button>
      </header>
      {open && (
        <div className="fixed inset-0 z-40 lg:hidden" role="dialog" aria-modal="true" aria-label="Menú de administración">
          <button type="button" aria-label="Cerrar menú" className="absolute inset-0 bg-black/60" onClick={() => setOpen(false)} />
          <div className="relative flex h-full w-72 flex-col bg-ink text-ivory">
            <div className="flex items-center justify-between border-b border-white/10 p-5">
              <p className="font-display text-xl font-semibold tracking-widest text-gold-light">7H ADMIN</p>
              <button type="button" onClick={() => setOpen(false)} aria-label="Cerrar" className="grid size-10 place-items-center rounded-full hover:bg-white/10"><CloseIcon /></button>
            </div>
            {nav}
          </div>
        </div>
      )}

      <main className="mx-auto w-full min-w-0 max-w-[1400px] px-5 py-8 lg:px-10 lg:py-10">{children}</main>
    </div>
  );
}
