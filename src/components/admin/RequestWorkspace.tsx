"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, type ReactNode } from "react";
import { adminFetch } from "./api";
import { uploadImage } from "./ImagePicker";
import { Badge, btnDanger, btnGhost, btnPrimary, inputCls, labelCls } from "./ui";
import { formatCOP } from "@/lib/format";
import { onlyDigits } from "@/components/ui/useFieldGuard";

type Alt = {
  id: string; round: number; name: string; brand: string | null; model: string | null; imageUrl: string | null; description: string | null; features: string[];
  referenceUrl: string | null; priceKind: "ESTIMADO" | "COTIZADO" | "FINAL"; priceCOP: number | null; extraCostsCOP: number | null; shippingCOP: number | null;
  availability: string | null; deliveryEstimate: string | null; warranty: string | null; validUntil: string | null; notes: string | null; internalNotes: string | null;
  recommended: boolean; status: string; sentAt: string | null;
};

export interface WorkspaceData {
  id: string; code: string; status: string; assignedAdminId: string | null;
  structured: { productName: string; brand: string | null; model: string | null; color: string | null; size: string | null; features: string | null; referenceStore: string | null; budgetCOP: number | null; phone: string | null };
  alternatives: Alt[];
  admins: { id: string; name: string }[];
  categories: { slug: string; label: string }[];
  statuses: { value: string; label: string }[];
  activeLinks: number;
}

function Panel({ title, children, hint }: { title: string; hint?: string; children: ReactNode }) {
  return (
    <section className="rounded-2xl border border-ink/[.07] bg-white p-5 shadow-soft">
      <h2 className="text-[11px] font-semibold uppercase tracking-widest text-ink-soft">{title}</h2>
      {hint && <p className="mt-1 text-[11px] leading-5 text-ink-soft">{hint}</p>}
      <div className="mt-4 space-y-3">{children}</div>
    </section>
  );
}

const num = (s: string) => (s.trim() === "" ? null : Math.round(Number(s.replace(/\D/g, ""))));
const emptyAlt = { name: "", brand: "", model: "", imageUrl: "", description: "", features: "", referenceUrl: "", priceKind: "ESTIMADO" as Alt["priceKind"], priceCOP: "", extraCostsCOP: "", shippingCOP: "", availability: "", deliveryEstimate: "", warranty: "", validUntil: "", notes: "", internalNotes: "", recommended: false };

/** Espacio de trabajo del expediente: estado, responsable, mensajes, notas, datos, alternativas, propuesta y oferta. */
export function RequestWorkspace({ data, priceKinds }: { data: WorkspaceData; priceKinds: Record<string, string> }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string }>();
  const act = async (body: unknown, okText: string) => {
    setBusy(true);
    setMsg(undefined);
    const r = await adminFetch(`/api/admin/solicitudes-especiales/${data.id}`, "POST", body);
    setBusy(false);
    setMsg(r.ok ? { ok: true, text: okText } : { ok: false, text: r.error ?? "No se pudo completar." });
    if (r.ok) router.refresh();
    return r.ok;
  };

  const [status, setStatus] = useState(data.status);
  const [statusNote, setStatusNote] = useState("");
  const [reply, setReply] = useState("");
  const [note, setNote] = useState("");
  const [s, setS] = useState({ ...data.structured, budget: data.structured.budgetCOP ? String(data.structured.budgetCOP) : "" });
  const [alt, setAlt] = useState(emptyAlt);
  const [editing, setEditing] = useState<string | null>(null);
  const [proposalMsg, setProposalMsg] = useState("");
  const [offer, setOffer] = useState({ price: "", category: data.categories[0]?.slug ?? "", hours: "72", weight: "" });
  const file = useRef<HTMLInputElement>(null);

  const drafts = data.alternatives.filter((a) => a.status === "BORRADOR");
  const accepted = data.alternatives.find((a) => a.status === "ACEPTADA");
  const rounds = [...new Set(data.alternatives.map((a) => a.round))].sort((a, b) => b - a);

  const editAlt = (a: Alt) => {
    setEditing(a.id);
    setAlt({ name: a.name, brand: a.brand ?? "", model: a.model ?? "", imageUrl: a.imageUrl ?? "", description: a.description ?? "", features: a.features.join("\n"), referenceUrl: a.referenceUrl ?? "", priceKind: a.priceKind, priceCOP: a.priceCOP != null ? String(a.priceCOP) : "", extraCostsCOP: a.extraCostsCOP != null ? String(a.extraCostsCOP) : "", shippingCOP: a.shippingCOP != null ? String(a.shippingCOP) : "", availability: a.availability ?? "", deliveryEstimate: a.deliveryEstimate ?? "", warranty: a.warranty ?? "", validUntil: a.validUntil ?? "", notes: a.notes ?? "", internalNotes: a.internalNotes ?? "", recommended: a.recommended });
  };
  const saveAlt = async () => {
    const t = (v: string) => (v.trim() ? v.trim() : null);
    const ok = await act({ action: "alternative", alternativeId: editing, data: {
      name: alt.name, brand: t(alt.brand), model: t(alt.model), imageUrl: t(alt.imageUrl), description: t(alt.description),
      features: alt.features.split("\n").map((f) => f.trim()).filter(Boolean), referenceUrl: t(alt.referenceUrl), priceKind: alt.priceKind,
      priceCOP: num(alt.priceCOP), extraCostsCOP: num(alt.extraCostsCOP), shippingCOP: num(alt.shippingCOP), availability: t(alt.availability),
      deliveryEstimate: t(alt.deliveryEstimate), warranty: t(alt.warranty), validUntil: t(alt.validUntil), notes: t(alt.notes), internalNotes: t(alt.internalNotes), recommended: alt.recommended,
    } }, editing ? "Alternativa actualizada." : "Alternativa agregada.");
    if (ok) { setAlt(emptyAlt); setEditing(null); }
  };
  const upload = async (f: File | undefined) => {
    if (!f) return;
    setBusy(true);
    const r = await uploadImage(f);
    setBusy(false);
    if (r.url) setAlt((p) => ({ ...p, imageUrl: r.url! }));
    else setMsg({ ok: false, text: r.error ?? "No se pudo subir la foto." });
  };
  const field = (k: keyof typeof alt, label: string, props: Record<string, unknown> = {}) => (
    <div><label className={labelCls} htmlFor={`alt-${k}`}>{label}</label><input id={`alt-${k}`} value={String(alt[k])} onChange={(e) => setAlt((p) => ({ ...p, [k]: e.target.value }))} className={inputCls} {...props} /></div>
  );

  return (
    <div className="space-y-6">
      {msg && <p role="status" className={`rounded-xl border p-3 text-sm ${msg.ok ? "border-success/40 text-success" : "border-error/40 text-error"}`}>{msg.text}</p>}

      <Panel title="Gestión" hint="Cada cambio queda en el historial. Los cambios a «En revisión», «No disponible» o «Cerrada» avisan al cliente por correo.">
        <div className="grid gap-3 sm:grid-cols-[1fr_1fr]">
          <div><label className={labelCls} htmlFor="st">Estado</label>
            <select id="st" value={status} onChange={(e) => setStatus(e.target.value)} className={inputCls}>{data.statuses.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</select></div>
          <div><label className={labelCls} htmlFor="as">Responsable</label>
            <select id="as" defaultValue={data.assignedAdminId ?? ""} onChange={(e) => act({ action: "assign", adminId: e.target.value || null }, "Responsable actualizado.")} className={inputCls}>
              <option value="">Sin asignar</option>{data.admins.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select></div>
        </div>
        <input value={statusNote} onChange={(e) => setStatusNote(e.target.value)} placeholder="Nota del cambio (opcional; en No disponible o Cerrada queda como motivo)" className={inputCls} maxLength={600} />
        <button type="button" disabled={busy || status === data.status} className={btnPrimary} onClick={() => act({ action: "status", status, note: statusNote || undefined }, "Estado actualizado.").then((ok) => ok && setStatusNote(""))}>Cambiar estado</button>
      </Panel>

      <Panel title="Responder al cliente" hint="Se envía por correo y queda en su conversación.">
        <textarea rows={3} value={reply} onChange={(e) => setReply(e.target.value)} maxLength={2000} className={inputCls} placeholder="Escribe tu respuesta" />
        <button type="button" disabled={busy || reply.trim().length < 2} className={btnPrimary} onClick={() => act({ action: "message", body: reply.trim() }, "Respuesta enviada.").then((ok) => ok && setReply(""))}>Enviar respuesta</button>
      </Panel>

      <Panel title="Nota interna" hint="Solo la ve el equipo. Nunca se muestra al cliente.">
        <textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} maxLength={2000} className={inputCls} placeholder="Proveedor contactado, costos, próximos pasos…" />
        <button type="button" disabled={busy || note.trim().length < 2} className={btnGhost} onClick={() => act({ action: "note", body: note.trim() }, "Nota guardada.").then((ok) => ok && setNote(""))}>Guardar nota</button>
      </Panel>

      <Panel title="Información estructurada" hint="Puedes corregirla. La descripción original del cliente se conserva aparte.">
        <div className="grid gap-3 sm:grid-cols-2">
          {([["productName", "Producto"], ["brand", "Marca"], ["model", "Modelo o referencia"], ["color", "Color"], ["size", "Talla"], ["referenceStore", "Tienda o país de referencia"], ["phone", "Teléfono"], ["budget", "Presupuesto (COP)"]] as const).map(([k, l]) => (
            <div key={k}><label className={labelCls} htmlFor={`s-${k}`}>{l}</label><input id={`s-${k}`} value={(s[k] as string | null) ?? ""} onChange={(e) => setS((p) => ({ ...p, [k]: e.target.value }))} className={inputCls} /></div>
          ))}
        </div>
        <div><label className={labelCls} htmlFor="s-features">Características deseadas</label><textarea id="s-features" rows={2} value={s.features ?? ""} onChange={(e) => setS((p) => ({ ...p, features: e.target.value }))} className={inputCls} /></div>
        <button type="button" disabled={busy} className={btnGhost} onClick={() => act({ action: "edit", data: { productName: s.productName, brand: s.brand || null, model: s.model || null, color: s.color || null, size: s.size || null, features: s.features || null, referenceStore: s.referenceStore || null, phone: s.phone || null, budgetCOP: num(s.budget) } }, "Información actualizada.")}>Guardar cambios</button>
      </Panel>

      <Panel title="Alternativas" hint="Prepara varias opciones. El cliente solo ve las enviadas; las notas internas y el proveedor nunca se le muestran.">
        {rounds.map((round) => (
          <div key={round} className="space-y-2">
            <p className="text-[11px] font-semibold text-ink-soft">Propuesta {round}</p>
            {data.alternatives.filter((a) => a.round === round).map((a) => (
              <div key={a.id} className="rounded-xl border border-ink/10 p-3 text-sm">
                <div className="flex flex-wrap items-center gap-2">
                  <strong>{a.name}</strong>
                  {a.recommended && <Badge tone="gold">Recomendada</Badge>}
                  <Badge tone={a.status === "ACEPTADA" ? "success" : a.status === "RECHAZADA" ? "error" : a.status === "ENVIADA" ? "warning" : "neutral"}>{a.status}</Badge>
                </div>
                <p className="mt-1 text-xs text-ink-soft">{priceKinds[a.priceKind]}: {a.priceCOP != null ? formatCOP(a.priceCOP) : "sin precio"}{a.validUntil ? ` · vigente hasta ${a.validUntil}` : ""}{a.deliveryEstimate ? ` · ${a.deliveryEstimate}` : ""}</p>
                {a.internalNotes && <p className="mt-1 text-xs text-warning">Interno: {a.internalNotes}</p>}
                {a.status === "BORRADOR" && (
                  <div className="mt-2 flex gap-2">
                    <button type="button" className={btnGhost} onClick={() => editAlt(a)}>Editar</button>
                    <button type="button" className={btnDanger} disabled={busy} onClick={() => window.confirm("¿Borrar esta alternativa?") && act({ action: "deleteAlternative", alternativeId: a.id }, "Alternativa borrada.")}>Borrar</button>
                  </div>
                )}
              </div>
            ))}
          </div>
        ))}

        <div className="rounded-xl bg-ivory/60 p-4">
          <p className="mb-3 text-sm font-semibold">{editing ? "Editar alternativa" : "Nueva alternativa"}</p>
          <div className="grid gap-3 sm:grid-cols-2">
            {field("name", "Producto *")}
            {field("brand", "Marca")}
            {field("model", "Modelo")}
            {field("referenceUrl", "Enlace de referencia", { placeholder: "https://" })}
            <div className="sm:col-span-2">
              <label className={labelCls} htmlFor="alt-imageUrl">Fotografía</label>
              <div className="flex gap-2"><input id="alt-imageUrl" value={alt.imageUrl} onChange={(e) => setAlt((p) => ({ ...p, imageUrl: e.target.value }))} className={inputCls} placeholder="Sube una foto o pega una URL permitida" /><button type="button" className={btnGhost} onClick={() => file.current?.click()} disabled={busy}>Subir</button></div>
              <input ref={file} type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={(e) => upload(e.target.files?.[0])} />
            </div>
            <div className="sm:col-span-2"><label className={labelCls} htmlFor="alt-desc">Descripción</label><textarea id="alt-desc" rows={2} value={alt.description} onChange={(e) => setAlt((p) => ({ ...p, description: e.target.value }))} className={inputCls} /></div>
            <div className="sm:col-span-2"><label className={labelCls} htmlFor="alt-feat">Características (una por línea)</label><textarea id="alt-feat" rows={2} value={alt.features} onChange={(e) => setAlt((p) => ({ ...p, features: e.target.value }))} className={inputCls} /></div>
            <div><label className={labelCls} htmlFor="alt-kind">Tipo de precio</label>
              <select id="alt-kind" value={alt.priceKind} onChange={(e) => setAlt((p) => ({ ...p, priceKind: e.target.value as Alt["priceKind"] }))} className={inputCls}>
                {Object.entries(priceKinds).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
              </select></div>
            {field("priceCOP", "Precio (COP)", { inputMode: "numeric" })}
            {field("extraCostsCOP", "Costos adicionales (COP)", { inputMode: "numeric" })}
            {field("shippingCOP", "Envío (COP)", { inputMode: "numeric" })}
            {field("availability", "Disponibilidad")}
            {field("deliveryEstimate", "Tiempo estimado de entrega", { placeholder: "Ej.: 10 a 15 días hábiles" })}
            {field("validUntil", "Vigente hasta", { type: "date" })}
            {field("warranty", "Garantía y condiciones")}
            <div className="sm:col-span-2"><label className={labelCls} htmlFor="alt-notes">Observaciones para el cliente</label><textarea id="alt-notes" rows={2} value={alt.notes} onChange={(e) => setAlt((p) => ({ ...p, notes: e.target.value }))} className={inputCls} /></div>
            <div className="sm:col-span-2"><label className={labelCls} htmlFor="alt-int">Notas internas y proveedor (confidencial)</label><textarea id="alt-int" rows={2} value={alt.internalNotes} onChange={(e) => setAlt((p) => ({ ...p, internalNotes: e.target.value }))} className={`${inputCls} border-warning/40`} /></div>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={alt.recommended} onChange={(e) => setAlt((p) => ({ ...p, recommended: e.target.checked }))} /> Marcar como recomendada</label>
          </div>
          <div className="mt-3 flex gap-2">
            <button type="button" disabled={busy || alt.name.trim().length < 2} className={btnPrimary} onClick={saveAlt}>{editing ? "Guardar alternativa" : "Agregar alternativa"}</button>
            {editing && <button type="button" className={btnGhost} onClick={() => { setEditing(null); setAlt(emptyAlt); }}>Cancelar</button>}
          </div>
        </div>

        {drafts.length > 0 && (
          <div className="rounded-xl border border-gold/40 p-4">
            <p className="text-sm font-semibold">Enviar propuesta al cliente ({drafts.length} {drafts.length === 1 ? "alternativa" : "alternativas"})</p>
            <textarea rows={2} value={proposalMsg} onChange={(e) => setProposalMsg(e.target.value)} placeholder="Mensaje opcional para acompañar la propuesta" className={`${inputCls} mt-2`} maxLength={1500} />
            <button type="button" disabled={busy} className={`${btnPrimary} mt-2`} onClick={() => window.confirm("¿Enviar la propuesta? El cliente recibirá un correo y ya no podrás editar estas alternativas.") && act({ action: "sendProposal", message: proposalMsg || undefined }, "Propuesta enviada al cliente.")}>Enviar propuesta</button>
          </div>
        )}
      </Panel>

      {accepted && (
        <Panel title="Oferta de compra" hint="Confirma de nuevo precio, disponibilidad y vigencia con el proveedor. Se crea un producto privado (1 unidad) que solo este cliente puede comprar por el checkout normal. La venta se confirma cuando el pedido queda pagado.">
          <p className="text-sm">Alternativa aceptada: <strong>{accepted.name}</strong></p>
          <div className="grid gap-3 sm:grid-cols-2">
            <div><label className={labelCls} htmlFor="of-price">Precio final de venta (COP) *</label><input maxLength={11} id="of-price" inputMode="numeric" value={offer.price} onChange={onlyDigits((e) => setOffer((p) => ({ ...p, price: e.target.value })), "money")} className={inputCls} placeholder={accepted.priceCOP ? String(accepted.priceCOP) : ""} /></div>
            <div><label className={labelCls} htmlFor="of-cat">Categoría</label><select id="of-cat" value={offer.category} onChange={(e) => setOffer((p) => ({ ...p, category: e.target.value }))} className={inputCls}>{data.categories.map((c) => <option key={c.slug} value={c.slug}>{c.label}</option>)}</select></div>
            <div><label className={labelCls} htmlFor="of-h">Vigencia de la oferta (horas)</label><input maxLength={7} id="of-h" inputMode="numeric" value={offer.hours} onChange={onlyDigits((e) => setOffer((p) => ({ ...p, hours: e.target.value })))} className={inputCls} /></div>
            <div><label className={labelCls} htmlFor="of-w">Peso empacado (g, para el envío)</label><input maxLength={7} id="of-w" inputMode="numeric" value={offer.weight} onChange={onlyDigits((e) => setOffer((p) => ({ ...p, weight: e.target.value })))} className={inputCls} /></div>
          </div>
          <button type="button" disabled={busy || !num(offer.price)} className={btnPrimary} onClick={() => window.confirm(`¿Confirmas ${formatCOP(num(offer.price) ?? 0)} como precio FINAL de venta?`) && act({ action: "offer", data: { alternativeId: accepted.id, priceCOP: num(offer.price), category: offer.category, hours: num(offer.hours) ?? 72, weightGrams: num(offer.weight) } }, "Oferta creada y enviada al cliente.")}>Preparar y enviar oferta</button>
        </Panel>
      )}

      <Panel title="Enlaces de acceso del cliente" hint="Los clientes sin cuenta entran con un enlace secreto que vence en 30 días.">
        <p className="text-sm">{data.activeLinks} enlace(s) vigente(s).</p>
        <button type="button" disabled={busy || data.activeLinks === 0} className={btnDanger} onClick={() => window.confirm("¿Revocar todos los enlaces? El cliente necesitará uno nuevo (se envía con la próxima respuesta).") && act({ action: "revokeLinks" }, "Enlaces revocados.")}>Revocar enlaces</button>
      </Panel>
    </div>
  );
}
