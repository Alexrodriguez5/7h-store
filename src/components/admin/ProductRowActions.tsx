"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { adminFetch } from "./api";
import { btnDanger, btnGhost } from "./ui";

export function ProductRowActions({ id, slug, name, active }: { id: string; slug: string; name: string; active: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string>();

  const run = async (fn: () => ReturnType<typeof adminFetch>) => {
    setBusy(true);
    setErr(undefined);
    const r = await fn();
    setBusy(false);
    if (!r.ok) setErr(r.error);
    else router.refresh();
  };

  return (
    <div className="space-y-1">
      <div className="flex flex-wrap gap-1.5">
        <Link href={`/producto/${slug}`} target="_blank" className={btnGhost}>Ver</Link>
        <Link href={`/admin/productos/${id}/editar`} className={btnGhost}>Editar</Link>
        <button type="button" disabled={busy} className={btnGhost}
          onClick={() => run(() => adminFetch(`/api/admin/products/${id}`, "PATCH", { active: !active }))}>{active ? "Desactivar" : "Activar"}</button>
        <button type="button" disabled={busy} className={btnDanger}
          onClick={() => window.confirm(`¿Eliminar "${name}" definitivamente? Solo es posible si no tiene pedidos; de lo contrario, desactívalo.`) && run(() => adminFetch(`/api/admin/products/${id}`, "DELETE"))}>Eliminar</button>
      </div>
      {err && <p role="alert" className="max-w-xs text-[11px] text-error">{err}</p>}
    </div>
  );
}
