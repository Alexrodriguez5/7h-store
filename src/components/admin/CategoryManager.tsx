"use client";
import { useState, type FormEvent } from "react";
import { adminFetch } from "./api";
import { ImagePicker } from "./ImagePicker";
import { Badge, btnDanger, btnGhost, btnPrimary, inputCls, labelCls, tdCls, thCls } from "./ui";
import { slugify } from "@/lib/schemas/admin";

export interface AdminCategory {
  id: string; slug: string; label: string; active: boolean; sortOrder: number; imageUrl: string | null; productCount: number; activeProductCount: number;
}

const sortCats = (list: AdminCategory[]) => [...list].sort((a, b) => a.sortOrder - b.sortOrder || a.label.localeCompare(b.label, "es"));

export function CategoryManager({ initial }: { initial: AdminCategory[] }) {
  const [cats, setCats] = useState(() => sortCats(initial));
  const [flash, setFlash] = useState<string>();
  const replace = (c: AdminCategory) => setCats((list) => sortCats(list.map((x) => (x.id === c.id ? c : x))));

  return (
    <div className="space-y-8">
      <NewCategoryForm onCreated={(c) => { setCats((l) => sortCats([...l, c])); setFlash(`Categoría «${c.label}» creada. Ya aparece en la tienda.`); }} />
      {flash && <p role="status" className="border border-success/40 bg-white p-3 text-sm text-success">{flash}</p>}
      <div className="overflow-x-auto border border-ink/10 bg-white">
        <table className="w-full min-w-[860px]">
          <caption className="sr-only">Categorías de la tienda</caption>
          <thead className="border-b border-ink/10">
            <tr><th className={thCls}>Orden</th><th className={thCls}>Nombre visible</th><th className={thCls}>Slug (URL)</th><th className={thCls}>Productos</th><th className={thCls}>Estado</th><th className={thCls}>Acciones</th></tr>
          </thead>
          <tbody className="divide-y divide-ink/10">
            {cats.map((c) => (
              <CategoryRow key={c.id} cat={c} onSaved={(n) => { replace(n); setFlash(undefined); }} onDeleted={() => { setCats((l) => l.filter((x) => x.id !== c.id)); setFlash(`Categoría «${c.label}» eliminada.`); }} />
            ))}
            {cats.length === 0 && <tr><td colSpan={6} className="px-4 py-12 text-center text-sm text-ink-soft">Aún no hay categorías. Crea la primera arriba.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function NewCategoryForm({ onCreated }: { onCreated: (c: AdminCategory) => void }) {
  const [label, setLabel] = useState("");
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string>();

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setErr(undefined);
    const r = await adminFetch<{ category: AdminCategory }>("/api/admin/categories", "POST", { label, slug, imageUrl });
    setBusy(false);
    if (!r.ok) return setErr(r.error);
    onCreated({ ...r.data.category, productCount: 0, activeProductCount: 0 });
    setLabel(""); setSlug(""); setSlugTouched(false); setImageUrl(null);
  };

  return (
    <form onSubmit={submit} className="grid gap-5 border border-ink/10 bg-white p-5 lg:grid-cols-[1fr_1fr_1fr_auto] lg:items-start" noValidate>
      <h2 className="text-[11px] font-semibold uppercase tracking-widest text-ink-soft lg:col-span-4">Nueva categoría</h2>
      <div>
        <label htmlFor="new-label" className={labelCls}>Nombre visible *</label>
        <input id="new-label" required maxLength={40} value={label} onChange={(e) => { setLabel(e.target.value); if (!slugTouched) setSlug(slugify(e.target.value).slice(0, 40)); }} className={inputCls} placeholder="Relojes" />
      </div>
      <div>
        <label htmlFor="new-slug" className={labelCls}>Slug (URL) *</label>
        <input id="new-slug" required maxLength={40} value={slug} onChange={(e) => { setSlugTouched(true); setSlug(e.target.value.toLowerCase()); }} className={`${inputCls} font-mono`} placeholder="relojes" aria-describedby="new-slug-help" />
        <p id="new-slug-help" className="mt-1 text-[11px] text-ink-soft">Minúsculas, números y guiones. No se puede cambiar después.</p>
      </div>
      <ImagePicker value={imageUrl} onChange={setImageUrl} label="Imagen de portada (opcional)" />
      <div className="lg:pt-5">
        <button type="submit" disabled={busy || label.trim().length < 2 || slug.trim().length < 2} aria-busy={busy} className={`${btnPrimary} w-full`}>{busy ? "Creando…" : "Crear categoría"}</button>
      </div>
      {err && <p role="alert" className="text-xs text-error lg:col-span-4">{err}</p>}
    </form>
  );
}

function CategoryRow({ cat, onSaved, onDeleted }: { cat: AdminCategory; onSaved: (c: AdminCategory) => void; onDeleted: () => void }) {
  const [editing, setEditing] = useState(false);
  const [label, setLabel] = useState(cat.label);
  const [order, setOrder] = useState(String(cat.sortOrder));
  const [imageUrl, setImageUrl] = useState<string | null>(cat.imageUrl);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string>();

  const patch = async (body: Record<string, unknown>) => {
    setBusy(true);
    setErr(undefined);
    const r = await adminFetch<{ category: AdminCategory }>(`/api/admin/categories/${cat.id}`, "PATCH", body);
    setBusy(false);
    if (!r.ok) { setErr(r.error); return false; }
    onSaved({ ...cat, ...r.data.category, productCount: cat.productCount, activeProductCount: cat.activeProductCount });
    return true;
  };

  const save = async () => {
    const sortOrder = Number(order);
    if (!Number.isInteger(sortOrder) || sortOrder < 0) return setErr("El orden debe ser un número entero mayor o igual a 0.");
    if (await patch({ label, sortOrder, imageUrl })) setEditing(false);
  };

  const remove = async () => {
    if (!window.confirm(`¿Eliminar la categoría «${cat.label}»? Solo es posible si no tiene productos.`)) return;
    setBusy(true);
    setErr(undefined);
    const r = await adminFetch(`/api/admin/categories/${cat.id}`, "DELETE");
    setBusy(false);
    if (!r.ok) return setErr(r.error);
    onDeleted();
  };

  return (
    <tr className={cat.active ? "" : "bg-ivory-200/40"}>
      <td className={tdCls}>{editing ? <input aria-label="Orden" inputMode="numeric" value={order} onChange={(e) => setOrder(e.target.value)} className={`${inputCls} w-20`} /> : cat.sortOrder}</td>
      <td className={tdCls}>
        {editing ? (
          <div className="space-y-3">
            <input aria-label="Nombre visible" maxLength={40} value={label} onChange={(e) => setLabel(e.target.value)} className={`${inputCls} max-w-[240px]`} />
            <ImagePicker value={imageUrl} onChange={setImageUrl} label="Imagen de portada" />
          </div>
        ) : (
          <span className="font-semibold">{cat.label}</span>
        )}
      </td>
      <td className={`${tdCls} font-mono text-xs`}>{cat.slug}</td>
      <td className={tdCls}>{cat.activeProductCount} activos<span className="block text-[11px] text-ink-soft">{cat.productCount} en total</span></td>
      <td className={tdCls}><Badge tone={cat.active ? "success" : "neutral"}>{cat.active ? "Visible" : "Oculta"}</Badge></td>
      <td className={tdCls}>
        <div className="flex flex-wrap gap-1.5">
          {editing ? (
            <>
              <button type="button" disabled={busy || label.trim().length < 2} onClick={save} className={btnPrimary}>{busy ? "Guardando…" : "Guardar"}</button>
              <button type="button" disabled={busy} onClick={() => { setEditing(false); setLabel(cat.label); setOrder(String(cat.sortOrder)); setImageUrl(cat.imageUrl); setErr(undefined); }} className={btnGhost}>Cancelar</button>
            </>
          ) : (
            <>
              <button type="button" disabled={busy} onClick={() => setEditing(true)} className={btnGhost}>Editar</button>
              <button type="button" disabled={busy} onClick={() => patch({ active: !cat.active })} className={btnGhost}>{cat.active ? "Ocultar" : "Mostrar"}</button>
              <button type="button" disabled={busy || cat.productCount > 0} title={cat.productCount > 0 ? "Tiene productos: no se puede eliminar" : undefined} onClick={remove} className={btnDanger}>Eliminar</button>
            </>
          )}
        </div>
        {err && <p role="alert" className="mt-1 max-w-xs text-[11px] text-error">{err}</p>}
      </td>
    </tr>
  );
}
