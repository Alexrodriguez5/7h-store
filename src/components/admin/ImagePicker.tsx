"use client";
import { useRef, useState } from "react";
import { btnGhost, inputCls } from "./ui";

/** Sube una imagen a /api/admin/uploads y devuelve su URL pública. Nunca lanza. */
export async function uploadImage(file: File): Promise<{ url?: string; error?: string }> {
  const form = new FormData();
  form.append("file", file);
  try {
    const res = await fetch("/api/admin/uploads", { method: "POST", body: form });
    const data = (await res.json().catch(() => ({}))) as { url?: string; error?: string };
    if (res.status === 401) window.location.assign("/admin/login");
    return res.ok && data.url ? { url: data.url } : { error: data.error ?? "No se pudo subir la imagen." };
  } catch {
    return { error: "Sin conexión. Revisa tu internet e inténtalo de nuevo." };
  }
}

/** Selector de UNA imagen (subida o URL https permitida), con vista previa. */
export function ImagePicker({ value, onChange, label = "Imagen" }: { value: string | null; onChange: (url: string | null) => void; label?: string }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string>();
  const [url, setUrl] = useState("");
  const pick = async (file?: File) => {
    if (!file) return;
    setBusy(true);
    setErr(undefined);
    const r = await uploadImage(file);
    setBusy(false);
    if (fileRef.current) fileRef.current.value = "";
    if (r.url) onChange(r.url);
    else setErr(r.error);
  };
  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold">{label}</p>
      {value && (
        <div className="flex items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={value} alt="" className="h-16 w-14 border border-ink/10 object-cover" />
          <button type="button" className={btnGhost} onClick={() => onChange(null)}>Quitar</button>
        </div>
      )}
      <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" disabled={busy} onChange={(e) => pick(e.target.files?.[0])} aria-label={`Subir ${label.toLowerCase()}`} className="block w-full text-xs file:mr-3 file:border file:border-ink/25 file:bg-transparent file:px-3 file:py-2 file:text-xs" />
      <div className="flex gap-2">
        <input aria-label="URL de imagen" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="…o pega una URL https" className={inputCls} />
        <button type="button" className={btnGhost} disabled={!url.trim()} onClick={() => { onChange(url.trim()); setUrl(""); }}>Usar</button>
      </div>
      <p className="text-[11px] text-ink-soft" aria-live="polite">{busy ? "Subiendo…" : err ? <span className="text-error">{err}</span> : "JPG, PNG o WebP · máx. 5 MB."}</p>
    </div>
  );
}
