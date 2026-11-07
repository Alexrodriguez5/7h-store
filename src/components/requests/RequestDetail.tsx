"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { formatCOP } from "@/lib/format";
import { useCartStore } from "@/store/cart-store";
import type { CustomerView } from "@/lib/services/special-requests";
import type { Product } from "@/types";

const PRICE_TEXT: Record<string, string> = {
  ESTIMADO: "Precio estimado · puede cambiar al confirmar",
  COTIZADO: "Cotización confirmada con el proveedor",
  FINAL: "Precio final de venta",
};
const fmt = (iso: string) => new Intl.DateTimeFormat("es-CO", { dateStyle: "medium", timeZone: "America/Bogota" }).format(new Date(iso));

async function post(code: string, body: Record<string, unknown>) {
  try {
    const res = await fetch(`/api/busquedas/${code}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const data = (await res.json().catch(() => ({}))) as { error?: string };
    return res.ok ? { ok: true as const } : { ok: false as const, error: data.error ?? "No se pudo completar." };
  } catch {
    return { ok: false as const, error: "Sin conexión. Inténtalo de nuevo." };
  }
}

/**
 * Lo que el cliente ve de su solicitud: estado, sus datos, alternativas con precios claramente etiquetados,
 * conversación y acciones (preguntar, aceptar, rechazar, comprar la oferta). Nada interno del equipo.
 */
export function RequestDetail({ view, statusText, token }: { view: CustomerView; statusText: string; token?: string }) {
  const router = useRouter();
  const addItem = useCartStore((s) => s.addItem);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const closed = ["CERRADA", "CONVERTIDA", "NO_DISPONIBLE", "FINALIZADA"].includes(view.status);
  const latestRound = Math.max(0, ...view.alternatives.map((a) => a.round));
  const current = view.alternatives.filter((a) => a.round === latestRound);
  const earlier = view.alternatives.filter((a) => a.round !== latestRound);
  const canDecide = view.status === "ESPERANDO_CLIENTE" || view.status === "PROPUESTA_ENVIADA";
  const imgSrc = (id: string) => `/media/busquedas/${id}${token ? `?t=${encodeURIComponent(token)}` : ""}`;

  const act = async (body: Record<string, unknown>) => {
    setBusy(true);
    setError(undefined);
    const r = await post(view.code, { ...body, ...(token ? { t: token } : {}) });
    setBusy(false);
    if (!r.ok) return setError(r.error);
    setMessage("");
    router.refresh();
  };

  const buy = async () => {
    setBusy(true);
    setError(undefined);
    const res = await fetch(`/api/busquedas/${view.code}/oferta${token ? `?t=${encodeURIComponent(token)}` : ""}`).catch(() => null);
    const data = (await res?.json().catch(() => null)) as { product?: Product; error?: string } | null;
    setBusy(false);
    if (!res?.ok || !data?.product) return setError(data?.error ?? "La oferta ya no está disponible.");
    addItem(data.product);
    router.push("/checkout");
  };

  return (
    <div className="grid gap-8 lg:grid-cols-[1.3fr_1fr]">
      <div className="space-y-6">
        <section className="surface rounded-[24px] p-6">
          <p className="type-eyebrow text-gold-deep">Estado</p>
          <p className="type-h3 mt-2">{statusText}</p>
          <p className="mt-2 text-xs text-ink-soft">Solicitud {view.code} · creada el {fmt(view.createdAt)}</p>
        </section>

        {view.offer && view.offer.status === "ACTIVA" && !view.offer.expired && (
          <section className="section-ink rounded-[24px] p-6 text-ivory">
            <p className="type-eyebrow text-gold-light">Tu oferta de compra</p>
            <p className="type-h3 mt-2">{view.offer.product.name}</p>
            <p className="type-price mt-2 text-2xl text-gold-light">{formatCOP(view.offer.priceCOP)}</p>
            <p className="mt-1 text-xs text-ivory/60">Precio final de venta · vence el {fmt(view.offer.expiresAt)}. Paga con el mismo correo de esta solicitud ({view.email}).</p>
            <button type="button" disabled={busy} onClick={buy} className="btn-shine mt-5 rounded-full bg-gold px-7 py-3 text-sm font-semibold text-ink transition-colors hover:bg-gold-light disabled:opacity-60">Comprar ahora</button>
          </section>
        )}

        {current.length > 0 && (
          <section aria-labelledby="alts">
            <h2 id="alts" className="type-h3">{current.length === 1 ? "Tu alternativa" : `Tus ${current.length} alternativas`}</h2>
            <ul className="mt-4 grid gap-4 md:grid-cols-2">
              {current.map((a) => (
                <li key={a.id} className={`surface flex flex-col overflow-hidden rounded-[22px] ${a.recommended ? "ring-2 ring-gold" : ""}`}>
                  {a.imageUrl && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={a.imageUrl} alt={a.name} loading="lazy" className="aspect-[4/3] w-full bg-ivory-200 object-cover" />
                  )}
                  <div className="flex flex-1 flex-col p-5">
                    <div className="flex flex-wrap gap-1.5">
                      {a.recommended && <span className="rounded-full bg-ink px-2.5 py-1 text-[10px] font-semibold text-gold-light">Recomendada</span>}
                      {a.status === "ACEPTADA" && <span className="rounded-full bg-success px-2.5 py-1 text-[10px] font-semibold text-ivory">Elegida</span>}
                      {a.expired && <span className="rounded-full bg-ink/10 px-2.5 py-1 text-[10px] font-semibold">Vigencia terminada</span>}
                    </div>
                    <p className="mt-2 text-[10px] font-semibold uppercase tracking-[.18em] text-ink-soft">{[a.brand, a.model].filter(Boolean).join(" · ")}</p>
                    <p className="font-display text-xl">{a.name}</p>
                    {a.priceCOP != null && <p className="type-price mt-2 text-xl">{formatCOP(a.priceCOP)}</p>}
                    <p className="text-[11px] text-ink-soft">{PRICE_TEXT[a.priceKind]}</p>
                    <dl className="mt-3 space-y-1 text-xs text-ink-soft">
                      {a.extraCostsCOP ? <div><dt className="inline font-semibold text-ink">Costos adicionales: </dt><dd className="inline">{formatCOP(a.extraCostsCOP)}</dd></div> : null}
                      {a.shippingCOP != null && <div><dt className="inline font-semibold text-ink">Envío: </dt><dd className="inline">{a.shippingCOP === 0 ? "Incluido" : formatCOP(a.shippingCOP)}</dd></div>}
                      {a.availability && <div><dt className="inline font-semibold text-ink">Disponibilidad: </dt><dd className="inline">{a.availability}</dd></div>}
                      {a.deliveryEstimate && <div><dt className="inline font-semibold text-ink">Entrega estimada: </dt><dd className="inline">{a.deliveryEstimate}</dd></div>}
                      {a.warranty && <div><dt className="inline font-semibold text-ink">Garantía: </dt><dd className="inline">{a.warranty}</dd></div>}
                      {a.validUntil && <div><dt className="inline font-semibold text-ink">Vigente hasta: </dt><dd className="inline">{fmt(a.validUntil)}</dd></div>}
                    </dl>
                    {a.description && <p className="mt-3 text-sm leading-6">{a.description}</p>}
                    {a.features.length > 0 && <ul className="mt-2 list-disc pl-5 text-sm leading-6">{a.features.map((f) => <li key={f}>{f}</li>)}</ul>}
                    {a.notes && <p className="mt-2 text-xs text-ink-soft">{a.notes}</p>}
                    {a.referenceUrl && <a href={a.referenceUrl} target="_blank" rel="noopener noreferrer nofollow" className="mt-2 text-xs underline">Ver referencia</a>}
                    {canDecide && a.status === "ENVIADA" && !a.expired && (
                      <button type="button" disabled={busy} onClick={() => window.confirm(`¿Eliges «${a.name}»? Antes de cobrar confirmaremos de nuevo precio y disponibilidad.`) && act({ action: "accept", alternativeId: a.id })} className="mt-4 rounded-full bg-ink py-3 text-sm font-semibold text-ivory transition-colors hover:bg-gold hover:text-ink disabled:opacity-60">Elegir esta alternativa</button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
            {canDecide && (
              <button type="button" disabled={busy} onClick={() => { const why = window.prompt("¿Por qué no te sirve ninguna? (opcional)") ; if (why !== null) act({ action: "reject", body: why.slice(0, 1000) || undefined }); }} className="mt-4 text-sm underline-offset-4 hover:underline">Ninguna me sirve</button>
            )}
            <p className="mt-3 text-[11px] leading-5 text-ink-soft">Los precios estimados pueden cambiar. Nada se cobra hasta que confirmemos tu oferta de compra y pagues por el checkout de la tienda.</p>
          </section>
        )}

        {earlier.length > 0 && (
          <details className="clean surface rounded-[20px] p-5 text-sm">
            <summary className="cursor-pointer font-semibold">Propuestas anteriores ({earlier.length})</summary>
            <ul className="mt-3 space-y-1">{earlier.map((a) => <li key={a.id}>{a.name} · {a.priceCOP != null ? formatCOP(a.priceCOP) : "—"} · {a.status.toLowerCase()}</li>)}</ul>
          </details>
        )}

        <section className="surface rounded-[24px] p-6">
          <h2 className="type-h3">Conversación</h2>
          <ol className="mt-4 space-y-3">
            {view.events.filter((e) => e.body).map((e) => (
              <li key={e.id} className={`rounded-2xl px-4 py-3 text-sm ${e.authorType === "customer" ? "ml-8 bg-ivory-200" : "mr-8 bg-ink text-ivory"}`}>
                <p className={`text-[11px] font-semibold ${e.authorType === "customer" ? "text-ink-soft" : "text-gold-light"}`}>{e.authorType === "customer" ? "Tú" : "7H STORE"} · {fmt(e.createdAt)}</p>
                <p className="mt-1 whitespace-pre-line">{e.body}</p>
              </li>
            ))}
          </ol>
          {!closed && (
            <div className="mt-4">
              <label htmlFor="msg" className="sr-only">Tu mensaje</label>
              <textarea id="msg" rows={3} value={message} onChange={(e) => setMessage(e.target.value)} maxLength={2000} placeholder="¿Cuál me recomiendan? ¿Hay otra opción más económica? ¿En otro color?" className="w-full rounded-xl border border-ink/15 bg-white px-3.5 py-3 text-sm outline-none focus:border-gold" />
              <button type="button" disabled={busy || message.trim().length < 2} onClick={() => act({ action: "message", body: message.trim() })} className="mt-2 rounded-full bg-ink px-6 py-2.5 text-sm font-semibold text-ivory transition-colors hover:bg-gold hover:text-ink disabled:opacity-50">Enviar pregunta</button>
            </div>
          )}
          {error && <p role="alert" className="mt-3 text-sm text-error">{error}</p>}
        </section>
      </div>

      <aside className="space-y-4">
        <section className="surface rounded-[24px] p-6 text-sm">
          <p className="type-eyebrow text-gold-deep">Lo que pediste</p>
          <dl className="mt-3 space-y-2">
            {([["Producto", view.productName], ["Marca", view.brand], ["Modelo", view.model], ["Color", view.color], ["Talla", view.size], ["Características", view.features], ["Tienda de referencia", view.referenceStore], ["Presupuesto", view.budgetCOP ? formatCOP(view.budgetCOP) : null], ["Comentarios", view.comments]] as const).filter(([, v]) => v).map(([k, v]) => (
              <div key={k}><dt className="text-[11px] text-ink-soft">{k}</dt><dd>{v}</dd></div>
            ))}
          </dl>
          {view.imageIds.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-2">
              {view.imageIds.map((id) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img key={id} src={imgSrc(id)} alt="Tu foto de referencia" loading="lazy" className="size-20 rounded-xl object-cover ring-1 ring-ink/10" />
              ))}
            </div>
          )}
          {view.links.length > 0 && <ul className="mt-3 space-y-1 text-xs">{view.links.map((l) => <li key={l} className="break-all"><a href={l} target="_blank" rel="noopener noreferrer nofollow" className="underline">{l}</a></li>)}</ul>}
        </section>
        <Link href="/tu-lo-buscas" className="block text-center text-sm underline-offset-4 hover:underline">Hacer otra búsqueda</Link>
      </aside>
    </div>
  );
}
