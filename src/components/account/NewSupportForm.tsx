"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, type FormEvent } from "react";
import { callApi } from "./api";
import { Notice, Panel, btnGold, fieldCls, labelCls } from "./ui";

interface OrderOpt { code: string; date: string; status: string; items: { id: string; name: string; size: string | null; quantity: number }[] }
interface TypeOpt { key: string; label: string; help: string; legal: string; needsItems: boolean }

const MAX_TOTAL = 4 * 1024 * 1024;

/** Formulario de solicitud: pedido, tipo (cada uno con su base legal), productos y cantidades, descripción y evidencias. */
export function NewSupportForm({ orders, initialOrder, types, phone }: { orders: OrderOpt[]; initialOrder: string; types: TypeOpt[]; phone: string }) {
  const router = useRouter();
  const [orderCode, setOrderCode] = useState(initialOrder);
  const [type, setType] = useState(types[0].key);
  const [qty, setQty] = useState<Record<string, number>>({});
  const [reason, setReason] = useState("");
  const [description, setDescription] = useState("");
  const [contactPhone, setContactPhone] = useState(phone);
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string>();

  const order = orders.find((o) => o.code === orderCode)!;
  const info = types.find((t) => t.key === type)!;
  const total = useMemo(() => files.reduce((s, f) => s + f.size, 0), [files]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (busy) return;
    const items = order.items.map((i) => ({ orderItemId: i.id, quantity: qty[i.id] ?? 0 })).filter((i) => i.quantity > 0);
    if (info.needsItems && items.length === 0) return setErr("Elige al menos un producto y su cantidad.");
    if (total > MAX_TOTAL) return setErr("Los archivos superan 4 MB en total.");
    setBusy(true);
    setErr(undefined);
    const fd = new FormData();
    fd.set("data", JSON.stringify({ orderCode, type, reason, description, contactPhone, items }));
    files.forEach((f) => fd.append("files", f));
    const r = await callApi<{ code: string }>("/api/cuenta/solicitudes", "POST", fd);
    setBusy(false);
    if (!r.ok) return setErr(r.data.error ?? "No pudimos registrar la solicitud.");
    router.push(`/cuenta/solicitudes/${r.data.code}?nueva=1`);
    router.refresh();
  };

  return (
    <form onSubmit={submit} className="space-y-6" noValidate>
      <Panel title="1. Pedido y tipo de solicitud">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="s-order" className={labelCls}>Pedido</label>
            <select id="s-order" value={orderCode} onChange={(e) => { setOrderCode(e.target.value); setQty({}); }} className={fieldCls}>
              {orders.map((o) => <option key={o.code} value={o.code}>{o.code} · {new Date(o.date).toLocaleDateString("es-CO")}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="s-type" className={labelCls}>Tipo de solicitud</label>
            <select id="s-type" value={type} onChange={(e) => setType(e.target.value)} className={fieldCls}>
              {types.map((t) => <option key={t.key} value={t.key}>{t.label}</option>)}
            </select>
          </div>
        </div>
        <div className="mt-4 rounded-2xl bg-ivory/80 p-4 text-sm">
          <p className="font-semibold">{info.label}</p>
          <p className="mt-1 text-ink-soft">{info.help}</p>
          <p className="mt-2 text-xs leading-5 text-ink-soft">{info.legal}</p>
        </div>
      </Panel>

      <Panel title={`2. Productos${info.needsItems ? "" : " (opcional)"}`}>
        <ul className="divide-y divide-ink/10">
          {order.items.map((i) => (
            <li key={i.id} className="flex items-center justify-between gap-4 py-3 text-sm">
              <span>{i.name}{i.size ? ` · Talla ${i.size}` : ""} <span className="text-ink-soft">(compraste {i.quantity})</span></span>
              <label className="flex items-center gap-2 text-xs">
                <span className="sr-only">Cantidad de {i.name}</span>
                <input type="number" min={0} max={i.quantity} value={qty[i.id] ?? 0} onChange={(e) => setQty((q) => ({ ...q, [i.id]: Math.max(0, Math.min(i.quantity, Number(e.target.value) || 0)) }))} className="w-20 rounded-lg border border-ink/15 bg-white px-3 py-2 text-center" />
              </label>
            </li>
          ))}
        </ul>
      </Panel>

      <Panel title="3. Cuéntanos qué pasó">
        <div className="space-y-4">
          <div><label htmlFor="s-reason" className={labelCls}>Motivo (corto)</label><input id="s-reason" maxLength={160} value={reason} onChange={(e) => setReason(e.target.value)} className={fieldCls} placeholder="Ej.: La suela llegó despegada" /></div>
          <div><label htmlFor="s-desc" className={labelCls}>Descripción</label><textarea id="s-desc" rows={5} maxLength={4000} value={description} onChange={(e) => setDescription(e.target.value)} className={fieldCls} placeholder="Describe el problema con el mayor detalle posible." /></div>
          <div><label htmlFor="s-phone" className={labelCls}>Celular de contacto (opcional)</label><input id="s-phone" inputMode="tel" value={contactPhone} onChange={(e) => setContactPhone(e.target.value.replace(/\D/g, "").slice(0, 10))} className={fieldCls} placeholder="3001234567" /></div>
          <div>
            <label htmlFor="s-files" className={labelCls}>Fotos o video (opcional, máximo 4 archivos y 4 MB en total)</label>
            <input id="s-files" type="file" multiple accept="image/jpeg,image/png,image/webp,image/heic,video/mp4,video/quicktime,video/webm" onChange={(e) => setFiles(Array.from(e.target.files ?? []).slice(0, 4))} className="block w-full text-sm file:mr-4 file:rounded-full file:border-0 file:bg-ink file:px-4 file:py-2 file:text-xs file:font-semibold file:text-ivory" />
            {files.length > 0 && <p className={`mt-1 text-xs ${total > MAX_TOTAL ? "text-error" : "text-ink-soft"}`}>{files.length} archivo(s) · {(total / 1024 / 1024).toFixed(1)} MB</p>}
          </div>
        </div>
      </Panel>

      {err && <Notice tone="error">{err}</Notice>}
      <button type="submit" disabled={busy} className={`${btnGold} w-full sm:w-auto`}>{busy ? "Enviando…" : "Enviar solicitud"}</button>
      <p className="text-xs text-ink-soft">Recibirás un número de radicado y la confirmación en tu correo. Una persona del equipo revisa cada caso.</p>
    </form>
  );
}
