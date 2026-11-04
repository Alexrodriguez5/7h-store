"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { adminFetch } from "./api";
import { btnDanger, btnGhost, btnPrimary } from "./ui";

/**
 * Botones de moderación reutilizables (reseñas, galería, comunidad).
 * `endpoint` recibe PATCH {status, note} y DELETE.
 */
export function ModerationActions({ endpoint, status, canDelete = true, labels = {} }: { endpoint: string; status: string; canDelete?: boolean; labels?: Partial<Record<"APROBADA" | "OCULTA" | "RECHAZADA", string>> }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const run = async (method: "PATCH" | "DELETE", body?: unknown) => {
    if (method === "DELETE" && !window.confirm("¿Eliminar definitivamente? No se puede deshacer.")) return;
    setBusy(true);
    setError(undefined);
    const r = await adminFetch(endpoint, method, body);
    setBusy(false);
    if (!r.ok) return setError(r.error);
    router.refresh();
  };
  const set = (s: string) => {
    const note = s === "RECHAZADA" ? window.prompt("Motivo del rechazo (opcional, uso interno):") ?? undefined : undefined;
    run("PATCH", { status: s, note });
  };
  return (
    <div className="flex flex-wrap items-center gap-2">
      {status !== "APROBADA" && <button type="button" disabled={busy} className={btnPrimary} onClick={() => set("APROBADA")}>{labels.APROBADA ?? "Aprobar"}</button>}
      {status === "APROBADA" && <button type="button" disabled={busy} className={btnGhost} onClick={() => set("OCULTA")}>{labels.OCULTA ?? "Ocultar"}</button>}
      {status !== "RECHAZADA" && <button type="button" disabled={busy} className={btnGhost} onClick={() => set("RECHAZADA")}>{labels.RECHAZADA ?? "Rechazar"}</button>}
      {canDelete && <button type="button" disabled={busy} className={btnDanger} onClick={() => run("DELETE")}>Eliminar</button>}
      {error && <span role="alert" className="text-xs text-error">{error}</span>}
    </div>
  );
}
