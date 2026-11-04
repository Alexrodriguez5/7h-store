"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { adminFetch } from "./api";
import { btnGhost, btnPrimary, inputCls } from "./ui";

/** Respuesta oficial de 7H STORE en una publicación y opción de fijarla arriba. */
export function OfficialReply({ endpoint, pinned }: { endpoint: string; pinned: boolean }) {
  const router = useRouter();
  const [reply, setReply] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string>();
  const send = async (body: unknown) => {
    setBusy(true);
    const r = await adminFetch(endpoint, "PATCH", body);
    setBusy(false);
    setMsg(r.ok ? "Guardado." : r.error);
    if (r.ok) { setReply(""); router.refresh(); }
  };
  return (
    <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_auto_auto] sm:items-start">
      <textarea aria-label="Respuesta oficial" rows={2} maxLength={1500} value={reply} onChange={(e) => setReply(e.target.value)} placeholder="Responder como 7H STORE (visible para todos)" className={inputCls} />
      <button type="button" disabled={busy || reply.trim().length < 2} className={btnPrimary} onClick={() => send({ reply: reply.trim() })}>Responder</button>
      <button type="button" disabled={busy} className={btnGhost} onClick={() => send({ pinned: !pinned })}>{pinned ? "Desfijar" : "Fijar arriba"}</button>
      {msg && <p role="status" className="text-xs text-ink-soft sm:col-span-3">{msg}</p>}
    </div>
  );
}
