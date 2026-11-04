"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { adminFetch } from "./api";
import { btnPrimary, inputCls } from "./ui";

/**
 * Respuesta + cambio de estado (solicitudes de producto y consultas).
 * La respuesta se envía al cliente por correo y queda guardada.
 */
export function ReplyStatusForm({ endpoint, status, statuses, replyLabel = "Responder al cliente" }: { endpoint: string; status: string; statuses: { value: string; label: string }[]; replyLabel?: string }) {
  const router = useRouter();
  const [next, setNext] = useState(status);
  const [reply, setReply] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string }>();
  const save = async () => {
    setBusy(true);
    setMsg(undefined);
    const r = await adminFetch(endpoint, "PATCH", { ...(next !== status ? { status: next } : {}), ...(reply.trim() ? { reply: reply.trim() } : {}) });
    setBusy(false);
    if (!r.ok) return setMsg({ ok: false, text: r.error ?? "No se pudo guardar." });
    setReply("");
    setMsg({ ok: true, text: reply.trim() ? "Guardado y enviado al cliente." : "Guardado." });
    router.refresh();
  };
  return (
    <div className="mt-4 grid gap-3 sm:grid-cols-[200px_1fr_auto] sm:items-start">
      <select aria-label="Estado" value={next} onChange={(e) => setNext(e.target.value)} className={inputCls}>
        {statuses.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
      </select>
      <textarea aria-label={replyLabel} placeholder={`${replyLabel} (opcional; se envía por correo)`} rows={2} maxLength={2000} value={reply} onChange={(e) => setReply(e.target.value)} className={inputCls} />
      <button type="button" disabled={busy || (next === status && !reply.trim())} onClick={save} className={btnPrimary}>{busy ? "Guardando…" : "Guardar"}</button>
      {msg && <p role="status" className={`text-xs sm:col-span-3 ${msg.ok ? "text-success" : "text-error"}`}>{msg.text}</p>}
    </div>
  );
}
