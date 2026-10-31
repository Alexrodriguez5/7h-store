"use client";

import Link from "next/link";
import { useRef, useState, type FormEvent } from "react";
import { useSearchParams } from "next/navigation";
import { formatCOP } from "@/lib/format";
import { normalizeEmail, normalizeOrderCode, validateTracking, type TrackingField } from "@/lib/order-tracking";
import { OrderTimeline } from "./OrderTimeline";
import { ArrowRightIcon, BoxIcon, SearchIcon, TruckIcon } from "@/components/ui/Icons";

interface TrackedOrder {
  publicCode: string;
  status: string;
  firstName: string;
  paymentMethod: string;
  subtotalCOP: number;
  shippingCOP: number;
  totalCOP: number;
  trackingNumber: string | null;
  carrier: string | null;
  city: string;
  department: string;
  shippingZone: string | null;
  shippingEta: string | null;
  createdAt: string;
  expiresAt: string;
  items: { name: string; size: string | null; quantity: number; unitPriceCOP: number }[];
}

type View =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "found"; order: TrackedOrder }
  | { kind: "not_found"; message: string }
  | { kind: "invalid"; message: string }
  | { kind: "limited"; message: string }
  | { kind: "error"; message: string };

const STATUS_LABEL: Record<string, string> = {
  pending_payment: "Pendiente de pago",
  paid: "Pago confirmado",
  processing: "Preparando pedido",
  shipped: "En camino",
  delivered: "Entregado",
  cancelled: "Cancelado",
  expired: "Vencido",
};
const METHOD: Record<string, string> = { CARD: "Tarjeta", PSE: "PSE", BANK_TRANSFER: "Transferencia", CASH_DEPOSIT: "Consignación" };
const fmtDate = (d: string) => new Intl.DateTimeFormat("es-CO", { dateStyle: "long", timeZone: "America/Bogota" }).format(new Date(d));

/** Formulario de rastreo conectado a /api/orders/lookup (datos reales; nunca simula resultados). */
export function TrackingForm() {
  const params = useSearchParams();
  const [code, setCode] = useState(() => normalizeOrderCode(params.get("codigo") ?? ""));
  const [email, setEmail] = useState("");
  const [errors, setErrors] = useState<Partial<Record<TrackingField, string>>>({});
  const [view, setView] = useState<View>({ kind: "idle" });
  const busy = useRef(false);
  const resultRef = useRef<HTMLDivElement>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (busy.current) return; // evita consultas repetidas
    const found = validateTracking(code, email);
    setErrors(found);
    if (Object.keys(found).length) return;
    const publicCode = normalizeOrderCode(code);
    setCode(publicCode);
    busy.current = true;
    setView({ kind: "loading" });
    try {
      const r = await fetch("/api/orders/lookup", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ publicCode, email: normalizeEmail(email) }) });
      const b = (await r.json().catch(() => ({}))) as { order?: TrackedOrder; error?: string };
      if (r.ok && b.order) setView({ kind: "found", order: b.order });
      else if (r.status === 404) setView({ kind: "not_found", message: b.error ?? "No encontramos un pedido con esos datos." });
      else if (r.status === 400) setView({ kind: "invalid", message: b.error ?? "Revisa los datos e inténtalo de nuevo." });
      else if (r.status === 429) setView({ kind: "limited", message: b.error ?? "Demasiadas consultas. Espera unos minutos." });
      else setView({ kind: "error", message: "Tuvimos un problema temporal al consultar. Inténtalo de nuevo en un momento." });
    } catch {
      setView({ kind: "error", message: "Sin conexión. Revisa tu internet e inténtalo de nuevo." });
    } finally {
      busy.current = false;
      requestAnimationFrame(() => resultRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" }));
    }
  }

  const loading = view.kind === "loading";
  const field = (invalid: boolean) =>
    `peer w-full rounded-xl border bg-white/80 py-3.5 pl-11 pr-4 text-sm outline-none transition-all placeholder:text-ink/35 focus:bg-white focus:ring-4 ${
      invalid ? "border-error/60 focus:border-error focus:ring-error/10" : "border-ink/15 hover:border-ink/30 focus:border-gold focus:ring-gold/15"
    }`;

  return (
    <div className="space-y-10">
      <form onSubmit={submit} noValidate className="relative rounded-3xl border border-ink/[.07] bg-white/70 p-6 shadow-lift backdrop-blur sm:p-8" aria-busy={loading}>
        <div className="grid gap-5 sm:grid-cols-2">
          <div>
            <label htmlFor="track-code" className="mb-1.5 block text-xs font-semibold">Número de pedido</label>
            <div className="relative">
              <BoxIcon width={18} height={18} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-ink/40" />
              <input
                id="track-code"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                onBlur={() => setCode((c) => normalizeOrderCode(c))}
                placeholder="7H-2026-AB12CD34"
                autoComplete="off"
                autoCapitalize="characters"
                spellCheck={false}
                maxLength={30}
                aria-invalid={!!errors.code}
                aria-describedby={errors.code ? "track-code-error" : undefined}
                className={`${field(!!errors.code)} font-mono uppercase tracking-wide`}
              />
            </div>
            {errors.code && <p id="track-code-error" className="mt-1.5 text-xs text-error">{errors.code}</p>}
          </div>
          <div>
            <label htmlFor="track-email" className="mb-1.5 block text-xs font-semibold">Correo de la compra</label>
            <div className="relative">
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true" className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-ink/40"><rect x="3" y="5" width="18" height="14" rx="2" /><path d="M3.5 6.5l8.5 6 8.5-6" /></svg>
              <input
                id="track-email"
                type="email"
                inputMode="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="tucorreo@ejemplo.com"
                maxLength={254}
                aria-invalid={!!errors.email}
                aria-describedby={errors.email ? "track-email-error" : undefined}
                className={field(!!errors.email)}
              />
            </div>
            {errors.email && <p id="track-email-error" className="mt-1.5 text-xs text-error">{errors.email}</p>}
          </div>
        </div>
        <button
          type="submit"
          disabled={loading}
          className="group mt-6 flex w-full items-center justify-center gap-2 rounded-full bg-gold px-6 py-4 text-sm font-semibold text-ink shadow-soft transition-all hover:bg-gold-light hover:shadow-lift active:scale-[.99] disabled:cursor-wait disabled:opacity-70"
        >
          {loading ? (
            <>
              <span aria-hidden="true" className="size-4 animate-spin rounded-full border-2 border-ink/25 border-t-ink" />
              Consultando tu pedido…
            </>
          ) : (
            <>
              <SearchIcon width={18} height={18} />
              Rastrear pedido
              <ArrowRightIcon width={16} height={16} className="transition-transform group-hover:translate-x-0.5" />
            </>
          )}
        </button>
        <p className="mt-4 text-center text-xs text-ink-soft">
          Encuentras el número en la confirmación de tu compra. Por tu seguridad pedimos también el correo.
        </p>
      </form>

      <div ref={resultRef} aria-live="polite">
        {view.kind === "loading" && (
          <div className="animate-pulse space-y-4 rounded-3xl border border-ink/[.07] bg-white/60 p-8">
            <div className="h-6 w-48 rounded-full bg-ink/10" />
            <div className="h-24 rounded-2xl bg-ink/5" />
            <div className="h-16 rounded-2xl bg-ink/5" />
          </div>
        )}

        {(view.kind === "not_found" || view.kind === "invalid" || view.kind === "limited" || view.kind === "error") && (
          <div role="alert" className="animate-fade-up rounded-3xl border border-ink/[.07] bg-white/70 p-8 text-center shadow-soft">
            <span className={`mx-auto grid size-14 place-items-center rounded-full ${view.kind === "error" || view.kind === "limited" ? "bg-warning/10 text-warning" : "bg-error/10 text-error"}`}>
              <svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><circle cx="12" cy="12" r="9" /><path d="M12 7.5v5.5M12 16.5h.01" /></svg>
            </span>
            <h2 className="mt-4 font-display text-3xl">
              {view.kind === "not_found" ? "No encontramos ese pedido" : view.kind === "invalid" ? "Revisa los datos" : view.kind === "limited" ? "Espera un momento" : "No pudimos consultar"}
            </h2>
            <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-ink-soft">{view.message}</p>
            {view.kind === "not_found" && (
              <p className="mx-auto mt-2 max-w-md text-xs text-ink-soft">Usa el mismo correo con el que compraste y copia el número tal como aparece (7H-AAAA-XXXXXXXX).</p>
            )}
            <Link href="/contacto" className="mt-5 inline-flex items-center gap-2 text-sm font-semibold underline-offset-4 hover:text-gold hover:underline">
              ¿Necesitas ayuda? Escríbenos <ArrowRightIcon width={14} height={14} />
            </Link>
          </div>
        )}

        {view.kind === "found" && <OrderResult order={view.order} />}
      </div>
    </div>
  );
}

function OrderResult({ order }: { order: TrackedOrder }) {
  const closed = order.status === "cancelled" || order.status === "expired";
  const delivered = order.status === "delivered";
  return (
    <section className="animate-fade-up overflow-hidden rounded-3xl border border-ink/[.07] bg-white/80 shadow-lift" aria-label={`Pedido ${order.publicCode}`}>
      <div className="relative overflow-hidden bg-ink px-6 py-7 text-ivory sm:px-8">
        <div aria-hidden="true" className="iso-grid pointer-events-none absolute inset-0 opacity-60" />
        <div className="relative flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[.25em] text-gold-light">Pedido</p>
            <h2 className="mt-1 break-all font-mono text-2xl tracking-wide sm:text-3xl">{order.publicCode}</h2>
            <p className="mt-2 text-sm text-ivory/70">Hola, {order.firstName}. Compra realizada el {fmtDate(order.createdAt)}.</p>
          </div>
          <span className={`rounded-full px-3.5 py-1.5 text-xs font-semibold ${closed ? "bg-white/10 text-ivory/80" : delivered ? "bg-success text-ivory" : "bg-gold text-ink"}`}>
            {STATUS_LABEL[order.status] ?? order.status}
          </span>
        </div>
      </div>

      <div className="space-y-8 p-6 sm:p-8">
        {closed ? (
          <p className="rounded-2xl border border-ink/10 bg-ivory p-5 text-sm leading-6">
            {order.status === "expired"
              ? "Este pedido venció porque no recibimos el pago a tiempo; las unidades se liberaron. Puedes hacer un pedido nuevo cuando quieras."
              : "Este pedido fue cancelado. Si ya habías pagado, escríbenos para gestionar la devolución de tu dinero."}
          </p>
        ) : (
          <OrderTimeline status={order.status} />
        )}

        {delivered && (
          <p className="rounded-2xl border border-success/30 bg-success/5 p-5 text-sm">¡Tu pedido fue entregado! Gracias por comprar en 7H STORE. Si algo no está bien, escríbenos.</p>
        )}

        <div className="grid gap-4 md:grid-cols-2">
          <div className="rounded-2xl border border-ink/[.07] bg-ivory/60 p-5">
            <h3 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-ink-soft"><TruckIcon width={16} height={16} /> Envío</h3>
            <dl className="mt-3 space-y-1.5 text-sm">
              <div className="flex justify-between gap-4"><dt className="text-ink-soft">Destino</dt><dd className="text-right">{order.city}, {order.department}</dd></div>
              {order.carrier && <div className="flex justify-between gap-4"><dt className="text-ink-soft">Transportadora</dt><dd>{order.carrier}</dd></div>}
              {order.trackingNumber && <div className="flex justify-between gap-4"><dt className="text-ink-soft">Número de guía</dt><dd className="font-mono font-semibold">{order.trackingNumber}</dd></div>}
              {order.shippingEta && !delivered && !closed && <div className="flex justify-between gap-4"><dt className="text-ink-soft">Entrega estimada</dt><dd className="text-right">{order.shippingEta} tras el pago</dd></div>}
              {!order.trackingNumber && !closed && !delivered && <p className="pt-1 text-xs text-ink-soft">La guía aparecerá aquí cuando despachemos tu pedido.</p>}
            </dl>
          </div>
          <div className="rounded-2xl border border-ink/[.07] bg-ivory/60 p-5">
            <h3 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-ink-soft"><BoxIcon width={16} height={16} /> Productos</h3>
            <ul className="mt-3 space-y-1.5 text-sm">
              {order.items.map((i, idx) => (
                <li key={`${i.name}-${idx}`} className="flex justify-between gap-4">
                  <span>{i.name} × {i.quantity}{i.size ? <span className="text-ink-soft"> · Talla {i.size}</span> : null}</span>
                  <span className="shrink-0">{formatCOP(i.unitPriceCOP * i.quantity)}</span>
                </li>
              ))}
            </ul>
            <dl className="mt-4 space-y-1 border-t border-ink/10 pt-3 text-sm">
              <div className="flex justify-between"><dt className="text-ink-soft">Subtotal</dt><dd>{formatCOP(order.subtotalCOP)}</dd></div>
              <div className="flex justify-between"><dt className="text-ink-soft">Envío</dt><dd>{order.shippingCOP ? formatCOP(order.shippingCOP) : "Gratis"}</dd></div>
              <div className="flex justify-between font-semibold"><dt>Total · {METHOD[order.paymentMethod] ?? order.paymentMethod}</dt><dd>{formatCOP(order.totalCOP)}</dd></div>
            </dl>
          </div>
        </div>

        <div className="flex flex-wrap gap-3">
          {order.status === "pending_payment" && (
            <Link href={`/pedido/${order.publicCode}`} className="rounded-full bg-ink px-6 py-3 text-sm font-semibold text-ivory transition-colors hover:bg-gold hover:text-ink">Completar el pago</Link>
          )}
          <Link href="/contacto" className="rounded-full border border-ink/20 px-6 py-3 text-sm font-semibold transition-colors hover:border-gold">¿Necesitas ayuda?</Link>
        </div>
      </div>
    </section>
  );
}
