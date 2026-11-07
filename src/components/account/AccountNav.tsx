"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { callApi } from "./api";

const LINKS = [
  { href: "/cuenta/pedidos", label: "Mis pedidos" },
  { href: "/cuenta/busquedas", label: "Mis solicitudes" },
  { href: "/cuenta/solicitudes", label: "Garantías y PQR" },
  { href: "/cuenta/perfil", label: "Mi perfil" },
  { href: "/cuenta/direcciones", label: "Direcciones" },
];

export function AccountNav() {
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
      <nav aria-label="Mi cuenta" className="surface no-scrollbar flex gap-1 overflow-x-auto rounded-[22px] p-1.5 lg:flex-col lg:p-2">
        {LINKS.map((l) => {
          const active = path.startsWith(l.href);
          return (
            <Link key={l.href} href={l.href} aria-current={active ? "page" : undefined} className={`shrink-0 rounded-full px-4 py-2.5 text-sm transition-colors ${active ? "bg-ink font-semibold text-gold-light" : "text-ink-soft hover:bg-white/70 hover:text-ink"}`}>
              {l.label}
            </Link>
          );
        })}
        <button type="button" onClick={logout} disabled={leaving} className="shrink-0 rounded-full px-4 py-2.5 text-left text-sm text-ink-soft transition-colors hover:bg-white/70 hover:text-error disabled:opacity-50">
          {leaving ? "Cerrando…" : "Cerrar sesión"}
        </button>
      </nav>
    </aside>
  );
}
