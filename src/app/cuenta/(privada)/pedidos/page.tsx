import Image from "next/image";
import Link from "next/link";
import type { Metadata } from "next";
import type { OrderStatus, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getCurrentCustomer } from "@/lib/customer/auth";
import { customerOrdersWhere } from "@/lib/services/support";
import { canRequestSupport, logisticsView, paymentView } from "@/lib/customer/order-view";
import { formatCOP } from "@/lib/format";
import { Notice, Panel, Pill, fmtDate } from "@/components/account/ui";

export const metadata: Metadata = { title: "Mis pedidos" };

const FILTERS: { key: string; label: string; statuses?: OrderStatus[] }[] = [
  { key: "todos", label: "Todos" },
  { key: "pendientes", label: "Pendientes de pago", statuses: ["PENDING_PAYMENT"] },
  { key: "en-curso", label: "En curso", statuses: ["PAID", "PROCESSING", "SHIPPED"] },
  { key: "entregados", label: "Entregados", statuses: ["DELIVERED"] },
  { key: "cerrados", label: "Cancelados o vencidos", statuses: ["CANCELLED", "EXPIRED"] },
];
const PERIODS: Record<string, number> = { "30": 30, "90": 90, "365": 365 };

/** Todos los pedidos del correo verificado (también los hechos como invitado), del más reciente al más antiguo. */
export default async function MyOrdersPage({ searchParams }: { searchParams: Promise<{ estado?: string; periodo?: string; bienvenida?: string }> }) {
  const c = (await getCurrentCustomer())!;
  const sp = await searchParams;
  const filter = FILTERS.find((f) => f.key === sp.estado) ?? FILTERS[0];
  const days = PERIODS[sp.periodo ?? ""];
  const where: Prisma.OrderWhereInput = {
    ...customerOrdersWhere(c),
    ...(filter.statuses ? { status: { in: filter.statuses } } : {}),
    ...(days ? { createdAt: { gte: new Date(Date.now() - days * 864e5) } } : {}),
  };
  const orders = await prisma.order.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: 100,
    select: {
      id: true, publicCode: true, status: true, createdAt: true, totalCOP: true, carrier: true, trackingNumber: true,
      payments: { select: { status: true, createdAt: true } },
      items: { select: { id: true, name: true, size: true, quantity: true, product: { select: { images: true } } } },
    },
  });
  const q = (o: Record<string, string | undefined>) => {
    const p = new URLSearchParams();
    const merged = { estado: sp.estado, periodo: sp.periodo, ...o };
    for (const [k, v] of Object.entries(merged)) if (v && v !== "todos") p.set(k, v);
    const s = p.toString();
    return s ? `?${s}` : "";
  };

  return (
    <>
      <div>
        <h1 className="font-display text-4xl sm:text-5xl">Mis pedidos</h1>
        <p className="mt-2 text-sm text-ink-soft">Todas las compras hechas con {c.email}, incluso como invitado.</p>
      </div>
      {sp.bienvenida && <Notice tone="success">¡Listo! Tu correo quedó confirmado.</Notice>}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="no-scrollbar -mx-1 flex gap-2 overflow-x-auto px-1">
          {FILTERS.map((f) => (
            <Link key={f.key} href={`/cuenta/pedidos${q({ estado: f.key })}`} className={`shrink-0 rounded-full border px-4 py-2 text-xs font-medium transition-colors ${filter.key === f.key ? "border-ink bg-ink text-ivory" : "border-ink/15 bg-white/60 hover:border-gold"}`}>
              {f.label}
            </Link>
          ))}
        </div>
        <div className="flex gap-2 text-xs">
          {[["", "Siempre"], ["30", "30 días"], ["90", "3 meses"], ["365", "1 año"]].map(([k, l]) => (
            <Link key={k} href={`/cuenta/pedidos${q({ periodo: k || undefined })}`} className={`rounded-full px-3 py-1.5 ${(sp.periodo ?? "") === k ? "bg-gold/20 font-semibold" : "text-ink-soft hover:text-ink"}`}>{l}</Link>
          ))}
        </div>
      </div>

      {orders.length === 0 ? (
        <Panel>
          <div className="py-8 text-center">
            <p className="font-display text-2xl">{c.emailVerifiedAt ? "No hay pedidos con este filtro" : "Confirma tu correo para ver tus pedidos"}</p>
            <p className="mt-2 text-sm text-ink-soft">Si compraste con otro correo, entra con ese correo o escríbenos desde «Solicitudes» para revisarlo.</p>
            <Link href="/catalogo" className="mt-5 inline-block rounded-full bg-ink px-6 py-3 text-sm font-semibold text-ivory hover:bg-gold hover:text-ink">Ir al catálogo</Link>
          </div>
        </Panel>
      ) : (
        <ul className="space-y-4">
          {orders.map((o) => {
            const pay = paymentView(o.status, o.payments);
            const log = logisticsView(o.status);
            const units = o.items.reduce((n, i) => n + i.quantity, 0);
            return (
              <li key={o.id} className="animate-fade-up rounded-3xl border border-ink/[.07] bg-white/75 p-5 shadow-soft transition-shadow hover:shadow-lift sm:p-6">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-mono text-lg font-semibold tracking-wide">{o.publicCode}</p>
                    <p className="text-xs text-ink-soft">{fmtDate(o.createdAt)} · {units} {units === 1 ? "producto" : "productos"}</p>
                  </div>
                  <div className="flex flex-wrap gap-2"><Pill tone={pay.tone}>{pay.label}</Pill><Pill tone={log.tone}>{log.label}</Pill></div>
                </div>
                <div className="mt-4 flex items-center gap-2 overflow-hidden">
                  {o.items.slice(0, 5).map((i) => (
                    <div key={i.id} className="relative size-14 shrink-0 overflow-hidden rounded-xl bg-ivory-200" title={`${i.name} × ${i.quantity}`}>
                      {i.product?.images[0] && <Image src={i.product.images[0]} alt={i.name} fill sizes="56px" className="object-cover" />}
                    </div>
                  ))}
                  <p className="ml-2 line-clamp-2 min-w-0 text-sm text-ink-soft">{o.items.map((i) => `${i.name}${i.size ? ` (${i.size})` : ""} × ${i.quantity}`).join(", ")}</p>
                </div>
                <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-ink/10 pt-4">
                  <p className="text-sm">Total <strong>{formatCOP(o.totalCOP)}</strong>{o.trackingNumber && <span className="text-ink-soft"> · Guía {o.trackingNumber}</span>}</p>
                  <div className="flex flex-wrap gap-2">
                    {canRequestSupport(o.status) && <Link href={`/cuenta/solicitudes/nueva?pedido=${o.publicCode}`} className="rounded-full border border-ink/20 px-4 py-2 text-xs font-semibold hover:border-gold">Soporte o devolución</Link>}
                    <Link href={`/cuenta/pedidos/${o.publicCode}`} className="rounded-full bg-ink px-4 py-2 text-xs font-semibold text-ivory hover:bg-gold hover:text-ink">Ver detalles</Link>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
