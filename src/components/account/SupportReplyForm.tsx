"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { callApi } from "./api";
import { Notice, btnDark, fieldCls, labelCls } from "./ui";

export function SupportReplyForm({ code }: { code: string }) {
  const router = useRouter();
  const [text, setText] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string>();

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (busy || text.trim().length < 2) return;
    setBusy(true);
    setErr(undefined);
    const fd = new FormData();
    fd.set("data", JSON.stringify({ text }));
    files.forEach((f) => fd.append("files", f));
    const r = await callApi(`/api/cuenta/solicitudes/${code}/mensajes`, "POST", fd);
    setBusy(false);
    if (!r.ok) return setErr(r.data.error ?? "No pudimos enviar el mensaje.");
    setText("");
    setFiles([]);
    router.refresh();
  };

  return (
    <form onSubmit={submit} className="space-y-3">
      <label htmlFor="reply" className={labelCls}>Escribe al equipo</label>
      <textarea id="reply" rows={3} maxLength={4000} value={text} onChange={(e) => setText(e.target.value)} className={fieldCls} placeholder="Agrega información o responde a lo que te pidieron." />
      <input type="file" multiple accept="image/jpeg,image/png,image/webp,image/heic,video/mp4,video/quicktime,video/webm" onChange={(e) => setFiles(Array.from(e.target.files ?? []).slice(0, 4))} aria-label="Adjuntar fotos o video" className="block w-full text-xs file:mr-3 file:rounded-full file:border-0 file:bg-ivory-200 file:px-3 file:py-1.5 file:text-xs" />
      <button type="submit" disabled={busy || text.trim().length < 2} className={btnDark}>{busy ? "Enviando…" : "Enviar"}</button>
      {err && <Notice tone="error">{err}</Notice>}
    </form>
  );
}
