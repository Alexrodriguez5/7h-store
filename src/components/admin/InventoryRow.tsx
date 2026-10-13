"use client";
import Link from "next/link";
import { useState } from "react";
import { adminFetch } from "./api";
import { Badge, btnPrimary, tdCls } from "./ui";

interface Variant { id: string; size: string; stock: number }
interface Props {
  productId: string; name: string; brand: string; active: boolean;
  variants: Variant[]; stock: number; lowThreshold: number;
}

/**
 * Fila de inventario autónoma: al guardar actualiza SOLO esta fila con la respuesta del servidor
 * (sin recargar toda la tabla). Envía el stock que se vio para no pisar compras hechas mientras tanto.
 */
export function InventoryRow({ productId, name, brand, active, variants: initialVariants, stock: initialStock, lowThreshold }: Props) {
  const [base, setBase] = useState({ variants: initialVariants, stock: initialStock });
  const [vals, setVals] = useState<Record<string, string>>(() => Object.fromEntries(initialVariants.map((v) => [v.id, String(v.stock)])));
  const [single, setSingle] = useState(String(initialStock));
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string }>();

  const hasSizes = base.variants.length > 0;
  const valid = (s: string) => /^\d{1,6}$/.test(s.trim());
  const dirty = hasSizes ? base.variants.some((v) => vals[v.id] !== String(v.stock)) : single !== String(base.stock);
  const allValid = hasSizes ? base.variants.every((v) => valid(vals[v.id])) : valid(single);
  const total = hasSizes ? base.variants.reduce((n, v) => n + v.stock, 0) : base.stock;
  const low = total > 0 && (total <= lowThreshold || base.variants.some((v) => v.stock > 0 && v.stock <= 1));

  const save = async () => {
    if (busy) return;
    setBusy(true);
    setMsg(undefined);
    const body = hasSizes
      ? { variants: base.variants.filter((v) => vals[v.id] !== String(v.stock)).map((v) => ({ id: v.id, stock: Number(vals[v.id]), expectedStock: v.stock })) }
      : { stock: Number(single), expectedStock: base.stock };
    const r = await adminFetch<{ stock: number; variants: Variant[] }>(`/api/admin/products/${productId}/stock`, "PATCH", body);
    setBusy(false);
    if (!r.ok) return setMsg({ ok: false, text: r.error ?? "Error" });
    const variants = hasSizes ? base.variants.map((v) => r.data.variants.find((x) => x.id === v.id) ?? v) : [];
    setBase({ variants, stock: r.data.stock });
    if (hasSizes) setVals(Object.fromEntries(variants.map((v) => [v.id, String(v.stock)])));
    else setSingle(String(r.data.stock));
    setMsg({ ok: true, text: "Guardado" });
  };

  const cell = (id: string, label: string, value: string, onChange: (s: string) => void) => (
    <label key={id} className="flex flex-col items-center gap-1 text-[10px] font-semibold text-ink-soft">
      {label}
      <input inputMode="numeric" value={value} onChange={(e) => { onChange(e.target.value); setMsg(undefined); }} aria-label={`Stock ${label}`} aria-invalid={!valid(value)}
        className={`w-16 border bg-white px-2 py-1.5 text-center text-sm text-ink outline-none focus:border-gold ${!valid(value) ? "border-error" : value.trim() === "0" ? "border-error/50" : "border-ink/20"}`} />
    </label>
  );

  return (
    <tr>
      <td className={tdCls}>
        <Link href={`/admin/productos/${productId}/editar`} className="font-semibold underline-offset-4 hover:underline">{name}</Link>
        <p className="text-[11px] text-ink-soft">{brand} · {active ? "Activo" : "Inactivo"}</p>
      </td>
      <td className={tdCls} aria-live="polite">
        {total === 0 ? <Badge tone="error">Agotado</Badge> : low ? <Badge tone="warning">{total} · Bajo</Badge> : <span className="font-semibold">{total}</span>}
      </td>
      <td className={tdCls}>
        <div className="flex flex-wrap items-end gap-3">
          {hasSizes ? base.variants.map((v) => cell(v.id, v.size, vals[v.id], (s) => setVals((p) => ({ ...p, [v.id]: s })))) : cell("single", "Unidades", single, setSingle)}
          <button type="button" disabled={busy || !dirty || !allValid} aria-busy={busy} onClick={save} className={btnPrimary}>{busy ? "Guardando…" : "Guardar"}</button>
          {msg && (msg.ok ? <Badge tone="success">{msg.text}</Badge> : <span role="alert" className="max-w-xs text-[11px] text-error">{msg.text}</span>)}
        </div>
      </td>
    </tr>
  );
}
