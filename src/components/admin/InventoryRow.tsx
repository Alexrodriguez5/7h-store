"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { adminFetch } from "./api";
import { Badge, btnPrimary } from "./ui";

interface Props { productId: string; variants: { id: string; size: string; stock: number }[]; stock: number }

export function InventoryRow({ productId, variants, stock }: Props) {
  const router = useRouter();
  const [vals, setVals] = useState<Record<string, string>>(Object.fromEntries(variants.map((v) => [v.id, String(v.stock)])));
  const [single, setSingle] = useState(String(stock));
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string }>();

  const valid = (s: string) => /^\d+$/.test(s.trim());
  const dirty = variants.length ? variants.some((v) => vals[v.id] !== String(v.stock)) : single !== String(stock);
  const allValid = variants.length ? variants.every((v) => valid(vals[v.id])) : valid(single);

  const save = async () => {
    setBusy(true);
    setMsg(undefined);
    const body = variants.length ? { variants: variants.map((v) => ({ id: v.id, stock: Number(vals[v.id]) })) } : { stock: Number(single) };
    const r = await adminFetch(`/api/admin/products/${productId}/stock`, "PATCH", body);
    setBusy(false);
    if (!r.ok) return setMsg({ ok: false, text: r.error ?? "Error" });
    setMsg({ ok: true, text: "Guardado" });
    router.refresh();
  };

  const cell = (id: string, label: string, value: string, onChange: (s: string) => void) => (
    <label key={id} className="flex flex-col items-center gap-1 text-[10px] font-semibold text-ink-soft">
      {label}
      <input inputMode="numeric" value={value} onChange={(e) => onChange(e.target.value)} aria-label={`Stock ${label}`}
        className={`w-16 border bg-white px-2 py-1.5 text-center text-sm text-ink outline-none focus:border-gold ${value.trim() === "0" ? "border-error/50" : "border-ink/20"} ${!valid(value) ? "border-error" : ""}`} />
    </label>
  );

  return (
    <div className="flex flex-wrap items-end gap-3">
      {variants.length ? variants.map((v) => cell(v.id, v.size, vals[v.id], (s) => setVals((p) => ({ ...p, [v.id]: s })))) : cell("single", "Unidades", single, setSingle)}
      <button type="button" disabled={busy || !dirty || !allValid} onClick={save} className={btnPrimary}>{busy ? "…" : "Guardar"}</button>
      {msg && (msg.ok ? <Badge tone="success">{msg.text}</Badge> : <span role="alert" className="text-[11px] text-error">{msg.text}</span>)}
    </div>
  );
}
