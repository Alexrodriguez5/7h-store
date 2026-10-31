"use client";

import { useState } from "react";
import { formatCOP } from "@/lib/format";
import { adminFetch } from "./api";
import { btnGhost, btnPrimary } from "./ui";

interface Rate { carrier: string; service: string; serviceDescription: string; totalCOP: number; deliveryEstimate: string | null }
interface Label { carrier: string; trackingNumber: string; trackUrl: string | null; labelUrl: string | null; totalCOP: number }

/** Cotiza con Envia y genera la guía del pedido. Al terminar, entrega transportadora y guía al formulario de envío. */
export function EnviaLabelPanel({ orderId, onLabel }: { orderId: string; onLabel: (carrier: string, tracking: string) => void }) {
  const [rates, setRates] = useState<Rate[]>();
  const [pick, setPick] = useState(0);
  const [label, setLabel] = useState<Label>();
  const [busy, setBusy] = useState<"quote" | "generate">();
  const [err, setErr] = useState<string>();

  const quote = async () => {
    setBusy("quote");
    setErr(undefined);
    const r = await adminFetch<{ rates: Rate[] }>(`/api/admin/orders/${orderId}/label`, "POST", { action: "quote" });
    setBusy(undefined);
    if (!r.ok) return setErr(r.error);
    setRates(r.data.rates);
    setPick(0);
  };

  const generate = async () => {
    const rate = rates?.[pick];
    if (!rate || !window.confirm(`¿Generar la guía con ${rate.carrier} por ${formatCOP(rate.totalCOP)}? Se descuenta del saldo de Envia.`)) return;
    setBusy("generate");
    setErr(undefined);
    const r = await adminFetch<{ label: Label }>(`/api/admin/orders/${orderId}/label`, "POST", { action: "generate", carrier: rate.carrier, service: rate.service });
    setBusy(undefined);
    if (!r.ok) return setErr(r.error);
    setLabel(r.data.label);
    onLabel(r.data.label.carrier, r.data.label.trackingNumber);
  };

  return (
    <div className="space-y-3 rounded-xl border border-gold/40 bg-gold/5 p-4">
      <p className="text-xs font-semibold uppercase tracking-widest text-ink-soft">Guía automática · Envia</p>
      {label ? (
        <div className="space-y-2 text-sm">
          <p>Guía <strong className="font-mono">{label.trackingNumber}</strong> con {label.carrier} ({formatCOP(label.totalCOP)}).</p>
          <div className="flex flex-wrap gap-2">
            {label.labelUrl && <a href={label.labelUrl} target="_blank" rel="noreferrer" className={btnPrimary}>Descargar guía (PDF)</a>}
            {label.trackUrl && <a href={label.trackUrl} target="_blank" rel="noreferrer" className={btnGhost}>Ver rastreo</a>}
          </div>
          <p className="text-xs text-ink-soft">Imprime la guía, pégala en el paquete y luego pulsa “Marcar como enviado”.</p>
        </div>
      ) : (
        <>
          {!rates && <button type="button" className={btnGhost} onClick={quote} disabled={!!busy}>{busy === "quote" ? "Cotizando…" : "Cotizar transportadoras"}</button>}
          {rates && (
            <fieldset className="space-y-2">
              <legend className="sr-only">Elige transportadora</legend>
              {rates.map((r, i) => (
                <label key={`${r.carrier}-${r.service}`} className={`flex cursor-pointer items-center justify-between gap-3 rounded-lg border bg-white px-3 py-2 text-sm ${pick === i ? "border-gold" : "border-ink/10"}`}>
                  <span className="flex items-center gap-2">
                    <input type="radio" name="envia-rate" checked={pick === i} onChange={() => setPick(i)} className="accent-gold" />
                    <span><strong className="capitalize">{r.carrier}</strong> · {r.serviceDescription}{r.deliveryEstimate && <span className="block text-[11px] text-ink-soft">{r.deliveryEstimate}</span>}</span>
                  </span>
                  <span className="font-semibold">{formatCOP(r.totalCOP)}</span>
                </label>
              ))}
              <button type="button" className={btnPrimary} onClick={generate} disabled={!!busy}>{busy === "generate" ? "Generando guía…" : "Generar guía"}</button>
            </fieldset>
          )}
        </>
      )}
      {err && <p role="alert" className="text-xs text-error">{err}</p>}
    </div>
  );
}
