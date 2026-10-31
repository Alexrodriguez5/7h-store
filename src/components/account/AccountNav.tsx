"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { callApi } from "./api";

const LINKS = [
  { href: "/cuenta/pedidos", label: "Mis pedidos" },
  { href: "/cuenta/solicitudes", label: "Solicitudes y garantías" },
  { href: "/cuenta/perfil", label: "Mi perfil" },
  { href: "/cuenta/direcciones", label: "Direcciones" },
];

export function AccountNav({ name, email, avatarUrl }: { name: string; email: string; avatarUrl: string | null }) {
  const path = usePathname();
  const router = useRouter();
  const [leaving, setLeaving] = useState(false);
  const logout = async () => {
    setLeaving(true);
    await callApi("/api/cuenta/salir", "POST");
    router.replace("/cuenta");
    router.refresh();
  };
  return (
    <aside className="h-fit space-y-4 lg:sticky lg:top-28">
      <div className="flex items-center gap-3 rounded-3xl bg-ink p-4 text-ivory shadow-lift">
        {avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={avatarUrl} alt="" width={44} height={44} referrerPolicy="no-referrer" className="size-11 rounded-full object-cover ring-2 ring-gold/60" />
        ) : (
          <span className="grid size-11 place-items-center rounded-full bg-gold font-display text-xl text-ink">{name.charAt(0).toUpperCase()}</span>
        )}
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold">{name}</p>
          <p className="truncate text-[11px] text-ivory/60">{email}</p>
        </div>
      </div>
      <nav aria-label="Mi cuenta" className="no-scrollbar flex gap-1 overflow-x-auto lg:flex-col">
        {LINKS.map((l) => {
          const active = path.startsWith(l.href);
          return (
            <Link key={l.href} href={l.href} aria-current={active ? "page" : undefined} className={`shrink-0 rounded-xl px-4 py-2.5 text-sm transition-colors ${active ? "bg-gold/20 font-semibold" : "text-ink-soft hover:bg-white/70 hover:text-ink"}`}>
              {l.label}
            </Link>
          );
        })}
        <button type="button" onClick={logout} disabled={leaving} className="shrink-0 rounded-xl px-4 py-2.5 text-left text-sm text-ink-soft transition-colors hover:bg-white/70 hover:text-error disabled:opacity-50">
          {leaving ? "Cerrando…" : "Cerrar sesión"}
        </button>
      </nav>
    </aside>
  );
}
