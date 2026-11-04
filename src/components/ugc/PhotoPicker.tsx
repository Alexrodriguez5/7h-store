"use client";

import { useEffect, useRef, useState } from "react";
import { MAX_UPLOAD_TOTAL, compressImage } from "@/lib/client-image";

/**
 * Selector de fotos con vista previa. Comprime cada foto en el navegador (y le quita la ubicación)
 * antes de agregarla. Devuelve los archivos listos para enviar.
 */
export function PhotoPicker({ files, onChange, max = 4, label = "Agregar fotos" }: { files: File[]; onChange: (f: File[]) => void; max?: number; label?: string }) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const [urls, setUrls] = useState<string[]>([]);

  useEffect(() => {
    const u = files.map((f) => URL.createObjectURL(f));
    setUrls(u);
    return () => u.forEach((x) => URL.revokeObjectURL(x));
  }, [files]);

  const add = async (list: FileList | null) => {
    if (!list?.length) return;
    setBusy(true);
    setError(undefined);
    const next = [...files];
    for (const f of Array.from(list).slice(0, max - files.length)) {
      try {
        if (f.size > 15 * 1024 * 1024) throw new Error("Esa foto es demasiado pesada (máx. 15 MB antes de comprimir).");
        next.push(await compressImage(f));
      } catch (e) {
        setError(e instanceof Error ? e.message : "No pudimos procesar la foto.");
      }
    }
    const total = next.reduce((n, f) => n + f.size, 0);
    if (total > MAX_UPLOAD_TOTAL) setError("Las fotos superan el tamaño permitido. Quita alguna.");
    else onChange(next);
    setBusy(false);
    if (input.current) input.current.value = "";
  };

  return (
    <div>
      <div className="flex flex-wrap gap-3">
        {urls.map((u, i) => (
          <div key={u} className="panel-in relative size-20 overflow-hidden rounded-2xl ring-1 ring-ink/10">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={u} alt={`Foto ${i + 1}`} className="size-full object-cover" />
            <button type="button" onClick={() => onChange(files.filter((_, j) => j !== i))} aria-label={`Quitar foto ${i + 1}`} className="absolute right-1 top-1 grid size-6 place-items-center rounded-full bg-ink/80 text-xs text-ivory">✕</button>
          </div>
        ))}
        {files.length < max && (
          <button type="button" onClick={() => input.current?.click()} disabled={busy} className="grid size-20 place-items-center rounded-2xl border border-dashed border-ink/25 bg-white/60 text-center text-[11px] font-medium leading-tight text-ink-soft transition-colors hover:border-gold hover:text-ink disabled:opacity-60">
            {busy ? "Procesando…" : <>＋<br />{label}</>}
          </button>
        )}
      </div>
      <input ref={input} type="file" accept="image/jpeg,image/png,image/webp" multiple hidden onChange={(e) => add(e.target.files)} />
      <p className="mt-2 text-[11px] text-ink-soft">JPG, PNG o WebP · hasta {max} fotos. Las comprimimos y les quitamos la ubicación antes de enviarlas.</p>
      {error && <p role="alert" className="mt-1 text-xs text-error">{error}</p>}
    </div>
  );
}

/** Envía JSON + fotos en un solo formulario multipart (campo "data" + "files"). */
export async function postMultipart(url: string, data: unknown, files: File[]) {
  const form = new FormData();
  form.set("data", JSON.stringify(data));
  files.forEach((f) => form.append("files", f));
  try {
    const res = await fetch(url, { method: "POST", body: form });
    const json = (await res.json().catch(() => ({}))) as Record<string, unknown> & { error?: string };
    return { ok: res.ok, status: res.status, data: json, error: res.ok ? undefined : json.error ?? "No se pudo enviar." };
  } catch {
    return { ok: false, status: 0, data: {}, error: "Sin conexión. Revisa tu internet e inténtalo de nuevo." };
  }
}
