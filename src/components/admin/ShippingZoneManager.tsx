"use client";

import { useMemo, useState } from "react";
import { COLOMBIA } from "@/data/colombia";
import { formatCOP } from "@/lib/format";
import { etaText } from "@/lib/shipping";
import { adminFetch } from "./api";
import { Badge, btnDanger, btnGhost, btnPrimary, inputCls, labelCls } from "./ui";

export interface ZoneRow {
  id: string;
  name: string;
  departments: string[];
  priceCOP: number;
  baseWeightGrams: number;
  extraPerKgCOP: number;
  minDays: number;
  maxDays: number;
  active: boolean;
  sortOrder: number;
}

const DEPARTMENTS = Object.keys(COLOMBIA);
const EMPTY: Omit<ZoneRow, "id"> = { name: "", departments: [], priceCOP: 18000, baseWeightGrams: 1000, extraPerKgCOP: 0, minDays: 5, maxDays: 10, active: true, sortOrder: 0 };

/** Editor de tarifas y plazos por zona. Los cambios se reflejan en el checkout de inmediato. */
export function ShippingZoneManager({ initial }: { initial: ZoneRow[] }) {
  const [zones, setZones] = useState(initial);
  const [editing, setEditing] = useState<ZoneRow | (Omit<ZoneRow, "id"> & { id?: undefined }) | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string }>();

  const covered = useMemo(() => new Set(zones.filter((z) => z.active).flatMap((z) => z.departments)), [zones]);
  const uncovered = DEPARTMENTS.filter((d) => !covered.has(d));

  async function save() {
    if (!editing || busy) return;
    setBusy(true);
    setMsg(undefined);
    const { id, ...data } = editing;
    const res = id
      ? await adminFetch<{ zone: ZoneRow }>(`/api/admin/shipping-zones/${id}`, "PATCH", data)
      : await adminFetch<{ zone: ZoneRow }>("/api/admin/shipping-zones", "POST", data);
    setBusy(false);
    if (!res.ok) return setMsg({ ok: false, text: res.error ?? "No se pudo guardar." });
    const z = res.data.zone;
    setZones((all) => (id ? all.map((x) => (x.id === id ? z : x)) : [...all, z]).sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name)));
    setEditing(null);
    setMsg({ ok: true, text: "Zona guardada. El checkout ya usa la nueva tarifa." });
  }

  async function remove(z: ZoneRow) {
    if (busy) return;
    setBusy(true);
    const res = await adminFetch(`/api/admin/shipping-zones/${z.id}`, "DELETE");
    setBusy(false);
    if (!res.ok) return setMsg({ ok: false, text: res.error ?? "No se pudo eliminar." });
    setZones((all) => all.filter((x) => x.id !== z.id));
    setMsg({ ok: true, text: `Zona "${z.name}" eliminada.` });
  }

  const set = <K extends keyof ZoneRow>(k: K, v: ZoneRow[K]) => setEditing((e) => (e ? { ...e, [k]: v } : e));
  const num = (v: string) => (v === "" ? 0 : Math.max(0, Math.round(Number(v))));

  return (
    <div className="space-y-6">
      {msg && (
        <p role={msg.ok ? "status" : "alert"} className={`rounded-xl border p-3 text-sm ${msg.ok ? "border-success/40 text-success" : "border-error/40 text-error"}`}>
          {msg.text}
        </p>
      )}

      {uncovered.length > 0 && (
        <p className="rounded-xl border border-warning/40 bg-white p-3 text-xs leading-5 text-ink-soft">
          <strong className="text-warning">Sin zona ({uncovered.length}):</strong> {uncovered.join(", ")}. A estos destinos se les cobra la tarifa de respaldo ({formatCOP(18000)}, {etaText(5, 10)}).
        </p>
      )}

      <div className="overflow-x-auto rounded-2xl border border-ink/[.07] bg-white shadow-soft">
        <table className="w-full min-w-[720px] text-sm">
          <thead>
            <tr className="text-left text-[10px] uppercase tracking-widest text-ink-soft">
              <th className="px-4 py-3">Zona</th>
              <th className="px-4 py-3">Departamentos</th>
              <th className="px-4 py-3">Tarifa</th>
              <th className="px-4 py-3">Plazo</th>
              <th className="px-4 py-3">Estado</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-ink/10">
            {zones.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-12 text-center text-ink-soft">Aún no hay zonas: todo el país usa la tarifa de respaldo.</td>
              </tr>
            )}
            {zones.map((z) => (
              <tr key={z.id} className="align-top">
                <td className="px-4 py-3 font-semibold">{z.name}</td>
                <td className="max-w-xs px-4 py-3 text-xs text-ink-soft">{z.departments.join(", ")}</td>
                <td className="px-4 py-3">
                  {formatCOP(z.priceCOP)}
                  <span className="block text-[11px] text-ink-soft">
                    hasta {z.baseWeightGrams / 1000} kg{z.extraPerKgCOP ? ` · +${formatCOP(z.extraPerKgCOP)}/kg` : ""}
                  </span>
                </td>
                <td className="px-4 py-3">{etaText(z.minDays, z.maxDays)}</td>
                <td className="px-4 py-3"><Badge tone={z.active ? "success" : "neutral"}>{z.active ? "Activa" : "Inactiva"}</Badge></td>
                <td className="whitespace-nowrap px-4 py-3 text-right">
                  <button type="button" className={btnGhost} onClick={() => setEditing({ ...z })}>Editar</button>{" "}
                  <button type="button" className={btnDanger} onClick={() => remove(z)} disabled={busy}>Eliminar</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {!editing && (
        <button type="button" className={btnPrimary} onClick={() => setEditing({ ...EMPTY, departments: [] })}>
          + Nueva zona
        </button>
      )}

      {editing && (
        <section className="space-y-5 rounded-2xl border border-ink/[.07] bg-white p-5 shadow-soft" aria-label="Editar zona">
          <h2 className="font-display text-2xl">{editing.id ? `Editar "${editing.name}"` : "Nueva zona"}</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div>
              <label className={labelCls} htmlFor="z-name">Nombre</label>
              <input id="z-name" className={inputCls} value={editing.name} onChange={(e) => set("name", e.target.value)} placeholder="Ej.: Llanos (local)" />
            </div>
            <div>
              <label className={labelCls} htmlFor="z-price">Tarifa (COP)</label>
              <input id="z-price" type="number" min={0} step={500} className={inputCls} value={editing.priceCOP} onChange={(e) => set("priceCOP", num(e.target.value))} />
            </div>
            <div>
              <label className={labelCls} htmlFor="z-base">Incluye hasta (gramos)</label>
              <input id="z-base" type="number" min={100} step={100} className={inputCls} value={editing.baseWeightGrams} onChange={(e) => set("baseWeightGrams", num(e.target.value))} />
            </div>
            <div>
              <label className={labelCls} htmlFor="z-extra">Valor por kg adicional (COP)</label>
              <input id="z-extra" type="number" min={0} step={500} className={inputCls} value={editing.extraPerKgCOP} onChange={(e) => set("extraPerKgCOP", num(e.target.value))} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls} htmlFor="z-min">Días mín.</label>
                <input id="z-min" type="number" min={0} className={inputCls} value={editing.minDays} onChange={(e) => set("minDays", num(e.target.value))} />
              </div>
              <div>
                <label className={labelCls} htmlFor="z-max">Días máx.</label>
                <input id="z-max" type="number" min={0} className={inputCls} value={editing.maxDays} onChange={(e) => set("maxDays", num(e.target.value))} />
              </div>
            </div>
            <div className="flex items-end gap-4">
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={editing.active} onChange={(e) => set("active", e.target.checked)} className="accent-gold" /> Activa
              </label>
              <div className="flex-1">
                <label className={labelCls} htmlFor="z-order">Orden</label>
                <input id="z-order" type="number" min={0} className={inputCls} value={editing.sortOrder} onChange={(e) => set("sortOrder", num(e.target.value))} />
              </div>
            </div>
          </div>

          <fieldset>
            <legend className={labelCls}>Departamentos ({editing.departments.length})</legend>
            <div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
              {DEPARTMENTS.map((d) => {
                const other = zones.find((z) => z.active && z.id !== editing.id && z.departments.includes(d));
                return (
                  <label key={d} className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-xs ${editing.departments.includes(d) ? "border-gold bg-gold/10" : "border-ink/10"} ${other ? "opacity-50" : ""}`}>
                    <input
                      type="checkbox"
                      className="accent-gold"
                      checked={editing.departments.includes(d)}
                      onChange={(e) => set("departments", e.target.checked ? [...editing.departments, d] : editing.departments.filter((x) => x !== d))}
                    />
                    <span>{d}{other && <span className="block text-[10px] text-ink-soft">en {other.name}</span>}</span>
                  </label>
                );
              })}
            </div>
          </fieldset>

          <p className="text-xs text-ink-soft">
            Ejemplo: un pedido de 3 kg paga {formatCOP(editing.priceCOP + Math.ceil(Math.max(0, 3000 - editing.baseWeightGrams) / 1000) * editing.extraPerKgCOP)}. Las compras desde $500.000 tienen envío gratis.
          </p>
          <div className="flex gap-3">
            <button type="button" className={btnPrimary} onClick={save} disabled={busy}>{busy ? "Guardando…" : "Guardar zona"}</button>
            <button type="button" className={btnGhost} onClick={() => setEditing(null)} disabled={busy}>Cancelar</button>
          </div>
        </section>
      )}
    </div>
  );
}
