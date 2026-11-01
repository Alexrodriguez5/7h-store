"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { adminFetch } from "./api";
import { btnGhost, btnPrimary, inputCls, labelCls } from "./ui";

interface Props {
  code: string;
  status: string;
  statuses: { key: string; label: string }[];
  admins: { id: string; name: string }[];
  assignedAdminId: string | null;
  resolution: string;
  refundAmountCOP: number | null;
  refundReference: string;
  orderTotalCOP: number;
}

/**
 * Acciones del equipo sobre una solicitud. El mensaje le llega al cliente por correo; la nota interna nunca.
 * Registrar un reembolso NO mueve dinero: solo deja constancia del que se hizo en Wompi o el banco.
 */
export function SupportStaffPanel(p: Props) {
  const router = useRouter();
  const [status, setStatus] = useState(p.status);
  const [message, setMessage] = useState("");
  const [note, setNote] = useState("");
  const [assigned, setAssigned] = useState(p.assignedAdminId ?? "");
  const [resolution, setResolution] = useState(p.resolution);
  const [refund, setRefund] = useState(p.refundAmountCOP ? String(p.refundAmountCOP) : "");
  const [refundRef, setRefundRef] = useState(p.refundReference);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string }>();

  const needsMessage = (status === "NO_APROBADA" || status === "INFO_SOLICITADA") && status !== p.status;

  const save = async (e: FormEvent) => {
    e.preventDefault();
    const body: Record<string, unknown> = {};
    if (status !== p.status) body.status = status;
    if (message.trim()) body.message = message.trim();
    if (note.trim()) body.note = note.trim();
    if ((assigned || null) !== p.assignedAdminId) body.assignedAdminId = assigned || null;
    if (resolution !== p.resolution) body.resolution = resolution;
    const refundNum = refund ? Math.round(Number(refund.replace(/\D/g, ""))) : null;
    if (refundNum !== p.refundAmountCOP) {
      if (refundNum && refundNum > p.orderTotalCOP) return setMsg({ ok: false, text: "El reembolso no puede superar el total del pedido." });
      if (refundNum && !confirm(`¿Registrar un reembolso de $${refundNum.toLocaleString("es-CO")}? Esto NO mueve dinero: confirma que ya lo hiciste en Wompi o el banco. El cliente recibirá un correo.`)) return;
      body.refundAmountCOP = refundNum;
    }
    if (refundRef !== p.refundReference) body.refundReference = refundRef || null;
    if (!Object.keys(body).length) return setMsg({ ok: false, text: "No hay cambios para guardar." });
    if (needsMessage && !message.trim()) return setMsg({ ok: false, text: status === "NO_APROBADA" ? "Explica al cliente el motivo." : "Escribe qué información necesitas." });
    setBusy(true);
    setMsg(undefined);
    const r = await adminFetch(`/api/admin/support/${p.code}`, "PATCH", body);
    setBusy(false);
    if (!r.ok) return setMsg({ ok: false, text: r.error ?? "Error" });
    setMessage("");
    setNote("");
    setMsg({ ok: true, text: "Guardado. Si hubo cambios visibles, el cliente recibe un correo." });
    router.refresh();
  };

  return (
    <form onSubmit={save} className="space-y-4">
      <div>
        <label htmlFor="sp-status" className={labelCls}>Estado</label>
        <select id="sp-status" value={status} onChange={(e) => setStatus(e.target.value)} className={inputCls}>
          {p.statuses.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
        </select>
      </div>
      <div>
        <label htmlFor="sp-msg" className={labelCls}>Mensaje al cliente {needsMessage && <span className="text-error">(obligatorio)</span>}</label>
        <textarea id="sp-msg" rows={3} maxLength={4000} value={message} onChange={(e) => setMessage(e.target.value)} className={inputCls} placeholder="Se envía por correo y queda en su historial." />
      </div>
      <div>
        <label htmlFor="sp-note" className={labelCls}>Nota interna <span className="font-normal text-ink-soft">(el cliente nunca la ve)</span></label>
        <textarea id="sp-note" rows={2} maxLength={4000} value={note} onChange={(e) => setNote(e.target.value)} className={`${inputCls} border-dashed`} />
      </div>
      <div>
        <label htmlFor="sp-assign" className={labelCls}>Asignada a</label>
        <select id="sp-assign" value={assigned} onChange={(e) => setAssigned(e.target.value)} className={inputCls}>
          <option value="">Sin asignar</option>
          {p.admins.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
        </select>
      </div>
      <div>
        <label htmlFor="sp-res" className={labelCls}>Solución acordada <span className="font-normal text-ink-soft">(visible para el cliente)</span></label>
        <textarea id="sp-res" rows={2} maxLength={4000} value={resolution} onChange={(e) => setResolution(e.target.value)} className={inputCls} placeholder="Ej.: Cambio por talla 42, envío a cargo de 7H." />
      </div>
      <fieldset className="rounded-xl border border-ink/10 p-3">
        <legend className="px-1 text-xs font-semibold">Registrar reembolso (no mueve dinero)</legend>
        <div className="grid gap-3 sm:grid-cols-2">
          <div><label htmlFor="sp-ref-amt" className={labelCls}>Valor COP</label><input id="sp-ref-amt" inputMode="numeric" value={refund} onChange={(e) => setRefund(e.target.value.replace(/\D/g, "").slice(0, 9))} className={inputCls} placeholder="0" /></div>
          <div><label htmlFor="sp-ref-id" className={labelCls}>Referencia</label><input id="sp-ref-id" maxLength={120} value={refundRef} onChange={(e) => setRefundRef(e.target.value)} className={inputCls} placeholder="ID Wompi o banco" /></div>
        </div>
      </fieldset>
      <div className="flex flex-wrap gap-2">
        <button type="submit" disabled={busy} className={btnPrimary}>{busy ? "Guardando…" : "Guardar"}</button>
        <button type="button" disabled={busy} onClick={() => { setStatus(p.status); setMessage(""); setNote(""); setAssigned(p.assignedAdminId ?? ""); setResolution(p.resolution); setRefund(p.refundAmountCOP ? String(p.refundAmountCOP) : ""); setRefundRef(p.refundReference); setMsg(undefined); }} className={btnGhost}>Descartar</button>
      </div>
      {msg && <p role={msg.ok ? "status" : "alert"} className={`text-xs ${msg.ok ? "text-success" : "text-error"}`}>{msg.text}</p>}
    </form>
  );
}
