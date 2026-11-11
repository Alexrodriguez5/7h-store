"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { COLOMBIA } from "@/data/colombia";
import type { ZodType } from "zod";
import { useFieldGuard } from "@/components/ui/useFieldGuard";
import { addressText, cityName, coMobile, freeText, personName, type FieldKind } from "@/lib/validation/fields";
import { callApi } from "./api";
import { Notice, Panel, Pill, btnDark, btnGold, btnLine, fieldCls, labelCls } from "./ui";

export interface Address {
  id: string; label: string; fullName: string; phone: string; department: string; city: string;
  address: string; neighborhood: string | null; notes: string | null; isDefault: boolean;
}
type Draft = Omit<Address, "id" | "neighborhood" | "notes"> & { neighborhood: string; notes: string };

const DEPARTMENTS = Object.keys(COLOMBIA).sort((a, b) => a.localeCompare(b, "es"));

/** Tipo de cada campo (filtro al escribir) y regla compartida con el servidor (al salir del campo y al guardar). */
const RULES: Partial<Record<keyof Draft, { kind: FieldKind | null; opts: { schema?: ZodType; required?: boolean; requiredMessage?: string } }>> = {
  label: { kind: null, opts: { required: true, requiredMessage: "Ponle un nombre (Casa, Oficina…)." } },
  fullName: { kind: "name", opts: { schema: personName(3, 120, "Nombre de quien recibe"), required: true, requiredMessage: "Escribe el nombre de quien recibe." } },
  phone: { kind: "phone", opts: { schema: coMobile, required: true, requiredMessage: "Escribe el celular de quien recibe." } },
  city: { kind: "city", opts: { schema: cityName, required: true, requiredMessage: "Escribe la ciudad o municipio." } },
  address: { kind: "address", opts: { schema: addressText(6, 200), required: true, requiredMessage: "Escribe la dirección." } },
  neighborhood: { kind: null, opts: { schema: freeText(100) } },
  notes: { kind: null, opts: { schema: freeText(300) } },
};

/** Libreta de direcciones: crear, editar, marcar principal y eliminar (solo las del cliente; el servidor lo verifica). */
export function AddressBook({ initial, max, defaultName, defaultPhone }: { initial: Address[]; max: number; defaultName: string; defaultPhone: string }) {
  const router = useRouter();
  const [editing, setEditing] = useState<string | "new" | null>(initial.length === 0 ? "new" : null);
  const [busyId, setBusyId] = useState<string>();
  const [err, setErr] = useState<string>();

  const empty: Draft = { label: "Casa", fullName: defaultName, phone: defaultPhone, department: "", city: "", address: "", neighborhood: "", notes: "", isDefault: initial.length === 0 };

  const remove = async (a: Address) => {
    if (!confirm(`¿Eliminar la dirección "${a.label}"?`)) return;
    setBusyId(a.id);
    const r = await callApi(`/api/cuenta/direcciones/${a.id}`, "DELETE");
    setBusyId(undefined);
    if (!r.ok) return setErr(r.data.error ?? "No pudimos eliminarla.");
    router.refresh();
  };
  const makeDefault = async (a: Address) => {
    setBusyId(a.id);
    const r = await callApi(`/api/cuenta/direcciones/${a.id}`, "PATCH", { ...a, neighborhood: a.neighborhood ?? "", notes: a.notes ?? "", isDefault: true });
    setBusyId(undefined);
    if (!r.ok) return setErr(r.data.error ?? "No pudimos actualizarla.");
    router.refresh();
  };

  return (
    <div className="space-y-6">
      {err && <Notice tone="error">{err}</Notice>}
      {initial.length > 0 && (
        <ul className="grid gap-4 md:grid-cols-2">
          {initial.map((a) => editing === a.id ? (
            <li key={a.id} className="md:col-span-2">
              <AddressForm initial={{ ...a, neighborhood: a.neighborhood ?? "", notes: a.notes ?? "" }} id={a.id} onDone={() => { setEditing(null); router.refresh(); }} onCancel={() => setEditing(null)} />
            </li>
          ) : (
            <li key={a.id} className="rounded-3xl border border-ink/[.07] bg-white/75 p-5 shadow-soft">
              <div className="flex items-center justify-between gap-2">
                <p className="font-semibold">{a.label}</p>
                {a.isDefault && <Pill tone="gold">Principal</Pill>}
              </div>
              <p className="mt-2 text-sm leading-6">{a.fullName} · {a.phone}<br />{a.address}{a.neighborhood ? `, ${a.neighborhood}` : ""}<br />{a.city}, {a.department}</p>
              {a.notes && <p className="mt-1 text-xs text-ink-soft">{a.notes}</p>}
              <div className="mt-4 flex flex-wrap gap-2 text-xs">
                <button type="button" onClick={() => setEditing(a.id)} className="rounded-full border border-ink/15 px-3 py-1.5 font-semibold hover:border-gold">Editar</button>
                {!a.isDefault && <button type="button" disabled={busyId === a.id} onClick={() => makeDefault(a)} className="rounded-full border border-ink/15 px-3 py-1.5 font-semibold hover:border-gold disabled:opacity-50">Usar como principal</button>}
                <button type="button" disabled={busyId === a.id} onClick={() => remove(a)} className="rounded-full px-3 py-1.5 font-semibold text-error hover:bg-error/5 disabled:opacity-50">Eliminar</button>
              </div>
            </li>
          ))}
        </ul>
      )}
      {editing === "new" ? (
        <AddressForm initial={empty} onDone={() => { setEditing(null); router.refresh(); }} onCancel={initial.length ? () => setEditing(null) : undefined} />
      ) : initial.length < max && editing === null ? (
        <button type="button" onClick={() => setEditing("new")} className={btnGold}>+ Agregar dirección</button>
      ) : null}
    </div>
  );
}

function AddressForm({ initial, id, onDone, onCancel }: { initial: Draft; id?: string; onDone: () => void; onCancel?: () => void }) {
  const [d, setD] = useState<Draft>(initial);
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [err, setErr] = useState<string>();
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setD((x) => ({ ...x, [k]: v }));

  const g = useFieldGuard();
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setErrors({});
    // Las mismas reglas que valida la API (lib/customer/addresses): si algo no cumple, no se envía.
    if (!g.check({ label: d.label, fullName: d.fullName, phone: d.phone, city: d.city, address: d.address, neighborhood: d.neighborhood, notes: d.notes })) return;
    if (!d.department) return setErrors({ department: "Elige el departamento" });
    setBusy(true);
    setErr(undefined);
    const r = await callApi<{ fields?: Record<string, string> }>(id ? `/api/cuenta/direcciones/${id}` : "/api/cuenta/direcciones", id ? "PATCH" : "POST", d);
    setBusy(false);
    if (!r.ok) {
      if (r.data.fields) setErrors(r.data.fields);
      return setErr(r.data.error ?? "Revisa los datos de la dirección.");
    }
    onDone();
  };

  const field = (k: keyof Draft, label: string, props: React.InputHTMLAttributes<HTMLInputElement> = {}) => {
    const rule = RULES[k];
    const gp = g.field<HTMLInputElement>(k, rule?.kind ?? null, (e) => set(k, e.target.value as never), rule?.opts);
    return (
      <div>
        <label htmlFor={`a-${k}`} className={labelCls}>{label}</label>
        <input id={`a-${k}`} value={String(d[k] ?? "")} className={fieldCls} {...props} {...gp} aria-invalid={Boolean(errors[k]) || gp["aria-invalid"]} />
        {errors[k] ? <p className="mt-1 text-xs text-error">{errors[k]}</p> : <g.Msg name={k} />}
      </div>
    );
  };

  const cities = COLOMBIA[d.department] ?? [];
  return (
    <Panel title={id ? "Editar dirección" : "Nueva dirección"}>
      <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2" noValidate>
        {field("label", "Nombre de la dirección", { placeholder: "Casa, Oficina…", maxLength: 40 })}
        {field("fullName", "Quién recibe", { autoComplete: "name", maxLength: 120 })}
        {field("phone", "Celular de quien recibe", { type: "tel", autoComplete: "tel-national", placeholder: "3001234567" })}
        <div>
          <label htmlFor="a-department" className={labelCls}>Departamento</label>
          <select id="a-department" value={d.department} onChange={(e) => set("department", e.target.value)} aria-invalid={Boolean(errors.department)} className={fieldCls}>
            <option value="">Elige…</option>
            {DEPARTMENTS.map((x) => <option key={x} value={x}>{x}</option>)}
          </select>
          {errors.department && <p className="mt-1 text-xs text-error">{errors.department}</p>}
        </div>
        {field("city", "Ciudad o municipio", { list: "a-cities", autoComplete: "address-level2", maxLength: 80 })}
        <datalist id="a-cities">{cities.map((x) => <option key={x} value={x} />)}</datalist>
        {field("address", "Dirección", { autoComplete: "street-address", placeholder: "Cra 10 # 20-14, apto 301", maxLength: 200 })}
        {field("neighborhood", "Barrio (opcional)", { maxLength: 100 })}
        {field("notes", "Indicaciones (opcional)", { placeholder: "Portería, torre, referencias…", maxLength: 300 })}
        <label className="flex items-center gap-2 text-sm sm:col-span-2">
          <input type="checkbox" checked={d.isDefault} onChange={(e) => set("isDefault", e.target.checked)} className="size-4 accent-gold" />
          Usar como dirección principal
        </label>
        {err && <div className="sm:col-span-2"><Notice tone="error">{err}</Notice></div>}
        <div className="flex flex-wrap gap-3 sm:col-span-2">
          <button type="submit" disabled={busy} className={btnDark}>{busy ? "Guardando…" : "Guardar dirección"}</button>
          {onCancel && <button type="button" onClick={onCancel} className={btnLine}>Cancelar</button>}
        </div>
      </form>
    </Panel>
  );
}
