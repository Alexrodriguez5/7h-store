"use client";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useRef, useState, type FormEvent } from "react";
import { adminFetch } from "./api";
import { uploadImage } from "./ImagePicker";
import { btnGhost, btnPrimary, inputCls, labelCls } from "./ui";
import { slugify } from "@/lib/schemas/admin";
import { sortSizes } from "@/lib/sizes";

export interface ProductFormValues {
  name: string; slug: string; brand: string; description: string; priceCOP: string; compareAtPriceCOP: string;
  category: string; gender: string; isAccessory: boolean; featured: boolean; active: boolean;
  images: string[]; tags: string; stock: string; hasSizes: boolean;
  /** `expectedStock` = stock que había al abrir el formulario (solo tallas ya existentes). */
  variants: { size: string; stock: string; expectedStock?: number }[];
  /** Stock al abrir el formulario (producto sin tallas). */
  expectedStock?: number;
}
export const EMPTY_PRODUCT: ProductFormValues = {
  name: "", slug: "", brand: "", description: "", priceCOP: "", compareAtPriceCOP: "", category: "", gender: "UNISEX",
  isAccessory: false, featured: false, active: true, images: [], tags: "", stock: "0", hasSizes: false, variants: [],
};

const PRESETS: Record<string, string[]> = { calzado: ["36", "37", "38", "39", "40", "41", "42", "43"], ropa: ["XS", "S", "M", "L", "XL"] };

export interface CategoryOption { slug: string; label: string; active: boolean }

export function ProductForm({ initial = EMPTY_PRODUCT, productId, categories }: { initial?: ProductFormValues; productId?: string; categories: CategoryOption[] }) {
  const router = useRouter();
  const [v, setV] = useState<ProductFormValues>(() => ({ ...initial, category: initial.category || categories.find((c) => c.active)?.slug || "" }));
  const [slugTouched, setSlugTouched] = useState(!!productId);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string>();
  const [urlInput, setUrlInput] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const set = <K extends keyof ProductFormValues>(k: K, val: ProductFormValues[K]) => setV((p) => ({ ...p, [k]: val }));

  const total = v.variants.reduce((n, x) => n + (Number(x.stock) || 0), 0);

  const upload = async (files: FileList | null) => {
    if (!files?.length) return;
    setUploading(true);
    setError(undefined);
    for (const file of Array.from(files).slice(0, Math.max(0, 8 - v.images.length))) {
      const r = await uploadImage(file);
      if (r.url) setV((p) => ({ ...p, images: [...p.images, r.url!] }));
      else { setError(r.error); break; }
    }
    setUploading(false);
    if (fileRef.current) fileRef.current.value = "";
  };

  const addPreset = () => {
    const have = new Set(v.variants.map((x) => x.size));
    const extra = (PRESETS[v.category] ?? []).filter((s) => !have.has(s)).map((s) => ({ size: s, stock: "0" }));
    set("variants", [...v.variants, ...extra]);
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (saving) return; // evita envíos duplicados
    setSaving(true);
    setError(undefined);
    const num = (s: string) => (s.trim() === "" ? NaN : Number(s));
    const payload = {
      name: v.name, slug: v.slug.trim() ? v.slug.trim() : undefined, brand: v.brand, description: v.description,
      priceCOP: num(v.priceCOP), compareAtPriceCOP: v.compareAtPriceCOP.trim() ? num(v.compareAtPriceCOP) : null,
      category: v.category, gender: v.gender, isAccessory: v.isAccessory, featured: v.featured, active: v.active,
      images: v.images, tags: v.tags.split(",").map((t) => t.trim()).filter(Boolean),
      stock: v.hasSizes ? 0 : num(v.stock),
      expectedStock: v.hasSizes ? undefined : v.expectedStock,
      variants: v.hasSizes
        ? sortSizes(v.variants.map((x) => x.size.trim().toUpperCase())).map((size) => {
            const row = v.variants.find((x) => x.size.trim().toUpperCase() === size)!;
            return { size, stock: num(row.stock), expectedStock: row.expectedStock };
          })
        : [],
    };
    const r = await adminFetch(productId ? `/api/admin/products/${productId}` : "/api/admin/products", productId ? "PUT" : "POST", payload);
    if (!r.ok) {
      setSaving(false);
      return setError(r.error);
    }
    // La lista de productos es dinámica: al navegar se cargan datos frescos (sin un refresh extra).
    router.push(`/admin/productos?guardado=${encodeURIComponent(v.name.trim())}`);
  };

  return (
    <form onSubmit={submit} className="grid gap-6 xl:grid-cols-[1.6fr_1fr]">
      <div className="space-y-6">
        <section className="space-y-4 border border-ink/10 bg-white p-5">
          <h2 className="text-[11px] font-semibold uppercase tracking-widest text-ink-soft">Información</h2>
          <div><label htmlFor="name" className={labelCls}>Nombre *</label>
            <input id="name" required value={v.name} onChange={(e) => { set("name", e.target.value); if (!slugTouched) set("slug", slugify(e.target.value)); }} className={inputCls} /></div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div><label htmlFor="brand" className={labelCls}>Marca *</label><input id="brand" required value={v.brand} onChange={(e) => set("brand", e.target.value)} className={inputCls} /></div>
            <div><label htmlFor="slug" className={labelCls}>Slug (URL)</label><input id="slug" value={v.slug} onChange={(e) => { setSlugTouched(true); set("slug", e.target.value); }} className={inputCls} placeholder="se genera del nombre" /></div>
          </div>
          <div><label htmlFor="description" className={labelCls}>Descripción *</label><textarea id="description" required rows={5} value={v.description} onChange={(e) => set("description", e.target.value)} className={inputCls} /></div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div><label htmlFor="price" className={labelCls}>Precio (COP) *</label><input id="price" type="number" inputMode="numeric" min={1} step={1} required value={v.priceCOP} onChange={(e) => set("priceCOP", e.target.value)} className={inputCls} /></div>
            <div><label htmlFor="compare" className={labelCls}>Precio anterior (opcional)</label><input id="compare" type="number" inputMode="numeric" min={1} step={1} value={v.compareAtPriceCOP} onChange={(e) => set("compareAtPriceCOP", e.target.value)} className={inputCls} /></div>
          </div>
          <div><label htmlFor="tags" className={labelCls}>Etiquetas de búsqueda (separadas por coma)</label><input id="tags" value={v.tags} onChange={(e) => set("tags", e.target.value)} className={inputCls} placeholder="running, nike, deportivo" /></div>
        </section>

        <section className="space-y-4 border border-ink/10 bg-white p-5">
          <div className="flex items-center justify-between">
            <h2 className="text-[11px] font-semibold uppercase tracking-widest text-ink-soft">Inventario</h2>
            <label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={v.hasSizes} onChange={(e) => set("hasSizes", e.target.checked)} /> Este producto maneja tallas</label>
          </div>
          {!v.hasSizes ? (
            <div className="max-w-xs"><label htmlFor="stock" className={labelCls}>Stock disponible *</label><input id="stock" type="number" min={0} step={1} required value={v.stock} onChange={(e) => set("stock", e.target.value)} className={inputCls} />
              <p className="mt-1 text-[11px] text-ink-soft">Sin tallas: el cliente lo agrega directo al carrito.</p></div>
          ) : (
            <div className="space-y-3">
              {v.variants.length === 0 && <p className="text-sm text-ink-soft">Agrega las tallas y su stock. Una talla en 0 se muestra agotada y no se puede comprar.</p>}
              {v.variants.map((row, i) => (
                <div key={i} className="grid grid-cols-[1fr_1fr_auto] items-end gap-3">
                  <div><label className="sr-only" htmlFor={`size-${i}`}>Talla</label><input id={`size-${i}`} placeholder="Talla" value={row.size} readOnly={row.expectedStock !== undefined} title={row.expectedStock !== undefined ? "Talla existente: para cambiarla quítala y agrega otra" : undefined} onChange={(e) => set("variants", v.variants.map((x, j) => (j === i ? { ...x, size: e.target.value } : x)))} className={`${inputCls} read-only:bg-ivory-200/40`} /></div>
                  <div><label className="sr-only" htmlFor={`vstock-${i}`}>Stock talla {row.size}</label><input id={`vstock-${i}`} type="number" min={0} step={1} placeholder="Stock" value={row.stock} onChange={(e) => set("variants", v.variants.map((x, j) => (j === i ? { ...x, stock: e.target.value } : x)))} className={`${inputCls} ${row.stock.trim() === "0" ? "border-error/50" : ""}`} /></div>
                  <button type="button" className={btnGhost} aria-label={`Quitar talla ${row.size}`} onClick={() => set("variants", v.variants.filter((_, j) => j !== i))}>✕</button>
                </div>
              ))}
              <div className="flex flex-wrap items-center gap-2">
                <button type="button" className={btnGhost} onClick={() => set("variants", [...v.variants, { size: "", stock: "0" }])}>+ Agregar talla</button>
                {PRESETS[v.category] && <button type="button" className={btnGhost} onClick={addPreset}>Agregar tallas típicas de {categories.find((c) => c.slug === v.category)?.label ?? v.category}</button>}
                <span className="ml-auto text-xs text-ink-soft">Total: {total} unidades</span>
              </div>
            </div>
          )}
        </section>
      </div>

      <div className="space-y-6">
        <section className="space-y-4 border border-ink/10 bg-white p-5">
          <h2 className="text-[11px] font-semibold uppercase tracking-widest text-ink-soft">Clasificación y estado</h2>
          <div>
            <label htmlFor="category" className={labelCls}>Categoría *</label>
            <select id="category" required value={v.category} onChange={(e) => set("category", e.target.value)} className={inputCls}>
              {!v.category && <option value="">Elige una categoría</option>}
              {categories.map((c) => <option key={c.slug} value={c.slug}>{c.label}{c.active ? "" : " (oculta)"}</option>)}
            </select>
            {categories.length === 0 && <p className="mt-1 text-[11px] text-error">Primero crea una categoría en «Categorías».</p>}
          </div>
          <div><label htmlFor="gender" className={labelCls}>Género</label><select id="gender" value={v.gender} onChange={(e) => set("gender", e.target.value)} className={inputCls}><option value="UNISEX">Unisex</option><option value="HOMBRE">Hombre</option><option value="MUJER">Mujer</option></select></div>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={v.isAccessory} onChange={(e) => set("isAccessory", e.target.checked)} /> Es un accesorio</label>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={v.featured} onChange={(e) => set("featured", e.target.checked)} /> Producto destacado (inicio)</label>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={v.active} onChange={(e) => set("active", e.target.checked)} /> Activo (visible en la tienda)</label>
        </section>

        <section className="space-y-4 border border-ink/10 bg-white p-5">
          <h2 className="text-[11px] font-semibold uppercase tracking-widest text-ink-soft">Imágenes *</h2>
          {v.images.length > 0 && (
            <ul className="grid grid-cols-2 gap-3">
              {v.images.map((src, i) => (
                <li key={src} className="space-y-2">
                  <div className="relative aspect-[4/5] overflow-hidden border border-ink/10 bg-ivory-200">
                    <Image src={src} alt={`Imagen ${i + 1}`} fill sizes="160px" className="object-cover" />
                    {i === 0 && <span className="absolute left-1 top-1 bg-gold px-1.5 py-0.5 text-[9px] font-semibold uppercase text-ink">Principal</span>}
                  </div>
                  <div className="flex gap-1">
                    {i !== 0 && <button type="button" className={`${btnGhost} flex-1 !px-1 !py-1 text-[10px]`} onClick={() => set("images", [src, ...v.images.filter((x) => x !== src)])}>Principal</button>}
                    <button type="button" className={`${btnGhost} flex-1 !px-1 !py-1 text-[10px]`} onClick={() => set("images", v.images.filter((x) => x !== src))}>Quitar</button>
                  </div>
                </li>
              ))}
            </ul>
          )}
          <div>
            <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={(e) => upload(e.target.files)} className="block w-full text-xs file:mr-3 file:border file:border-ink/25 file:bg-transparent file:px-3 file:py-2 file:text-xs" disabled={uploading || v.images.length >= 8} />
            <p className="mt-1 text-[11px] text-ink-soft">{uploading ? "Subiendo…" : "JPG, PNG o WebP · máx. 5 MB · hasta 8 imágenes."}</p>
          </div>
          <div className="flex gap-2">
            <input aria-label="URL de imagen" value={urlInput} onChange={(e) => setUrlInput(e.target.value)} placeholder="…o pega una URL https" className={inputCls} />
            <button type="button" className={btnGhost} disabled={!urlInput.trim()} onClick={() => { set("images", [...v.images, urlInput.trim()]); setUrlInput(""); }}>Añadir</button>
          </div>
        </section>

        {error && <p role="alert" className="border border-error/40 bg-white p-3 text-sm text-error">{error}</p>}
        <div className="flex gap-3">
          <button type="submit" disabled={saving || uploading || !v.category} aria-busy={saving} className={`${btnPrimary} flex-1`}>{saving ? "Guardando…" : productId ? "Guardar cambios" : "Crear producto"}</button>
          <button type="button" className={btnGhost} onClick={() => router.push("/admin/productos")}>Cancelar</button>
        </div>
      </div>
    </form>
  );
}
