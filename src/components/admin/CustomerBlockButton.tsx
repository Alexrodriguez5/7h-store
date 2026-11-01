"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { adminFetch } from "./api";
import { btnDanger, btnGhost } from "./ui";

/** Bloquear cierra todas las sesiones del cliente y le impide entrar. No toca sus pedidos. */
export function CustomerBlockButton({ id, blocked }: { id: string; blocked: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string>();
  const toggle = async () => {
    let reason: string | undefined;
    if (!blocked) {
      const r = prompt("¿Por qué bloqueas a este cliente? (queda en la auditoría)");
      if (r === null) return;
      reason = r;
    } else if (!confirm("¿Desbloquear a este cliente?")) return;
    setBusy(true);
    const r = await adminFetch(`/api/admin/customers/${id}`, "PATCH", { blocked: !blocked, reason });
    setBusy(false);
    if (!r.ok) return setErr(r.error);
    router.refresh();
  };
  return (
    <div className="text-right">
      <button type="button" onClick={toggle} disabled={busy} className={blocked ? btnGhost : btnDanger}>{busy ? "…" : blocked ? "Desbloquear" : "Bloquear cliente"}</button>
      {err && <p className="mt-1 text-xs text-error">{err}</p>}
    </div>
  );
}
