"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, type FormEvent } from "react";
import { adminFetch } from "./api";
import { uploadImage } from "./ImagePicker";
import { btnGhost, btnPrimary, inputCls, labelCls } from "./ui";

/** Agregar contenido propio de la tienda a "Así se vive 7H": foto (subida o URL permitida) o video. */
export function StoreMediaForm() {
  const router = useRouter();
  const [kind, setKind] = useState<"IMAGEN" | "VIDEO">("IMAGEN");
  const [url, setUrl] = useState("");
  const [caption, setCaption] = useState("");
  const [productSlug, setProductSlug] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string }>();
  const file = useRef<HTMLInputElement>(null);

  const upload = async (f: File | undefined) => {
    if (!f) return;
    setBusy(true);
    const r = await uploadImage(f);
    setBusy(false);
    if (r.url) setUrl(r.url);
    else setMsg({ ok: false, text: r.error ?? "No se pudo subir." });
  };
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setMsg(undefined);
    const r = await adminFetch("/api/admin/galeria", "POST", { kind, url, caption, productSlug, featured: true });
    setBusy(false);
    if (!r.ok) return setMsg({ ok: false, text: r.error ?? "No se pudo guardar." });
    setUrl("");
    setCaption("");
    setProductSlug("");
    setMsg({ ok: true, text: "Publicado en la galería." });
    router.refresh();
  };
  return (
    <form onSubmit={submit} className="mb-8 grid gap-4 rounded-2xl border border-ink/[.07] bg-white p-5 shadow-soft md:grid-cols-2">
      <div>
        <span className={labelCls}>Tipo</span>
        <div className="flex gap-2">
          {(["IMAGEN", "VIDEO"] as const).map((k) => (
            <button key={k} type="button" onClick={() => setKind(k)} className={kind === k ? btnPrimary : btnGhost}>{k === "IMAGEN" ? "Foto" : "Video"}</button>
          ))}
        </div>
      </div>
      <div>
        <label htmlFor="media-url" className={labelCls}>{kind === "IMAGEN" ? "Foto (sube o pega URL)" : "Enlace de YouTube, Vimeo o .mp4"}</label>
        <div className="flex gap-2">
          <input id="media-url" value={url} onChange={(e) => setUrl(e.target.value)} className={inputCls} placeholder="https://" />
          {kind === "IMAGEN" && <button type="button" className={btnGhost} onClick={() => file.current?.click()} disabled={busy}>Subir</button>}
        </div>
        <input ref={file} type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={(e) => upload(e.target.files?.[0])} />
      </div>
      <div><label htmlFor="media-caption" className={labelCls}>Descripción</label><input id="media-caption" value={caption} onChange={(e) => setCaption(e.target.value)} maxLength={140} className={inputCls} /></div>
      <div><label htmlFor="media-product" className={labelCls}>Producto relacionado (slug, opcional)</label><input id="media-product" value={productSlug} onChange={(e) => setProductSlug(e.target.value)} className={inputCls} placeholder="ej.: carhartt-jacket" /></div>
      <div className="flex items-center gap-3 md:col-span-2">
        <button type="submit" disabled={busy || !url.trim()} className={btnPrimary}>{busy ? "Guardando…" : "Publicar en la galería"}</button>
        {msg && <span role="status" className={`text-xs ${msg.ok ? "text-success" : "text-error"}`}>{msg.text}</span>}
      </div>
    </form>
  );
}
