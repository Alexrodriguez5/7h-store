import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { requireCustomerPage } from "@/lib/customer/auth";
import { findCustomerOrder } from "@/lib/services/support";
import { canRequestSupport, carrierSite, logisticsView, paymentView } from "@/lib/customer/order-view";
import { PAYMENT_METHOD_LABEL } from "@/lib/order-status";
import { SUPPORT_STATUS, SUPPORT_TYPES } from "@/lib/support";
import { formatCOP } from "@/lib/format";
import { OrderTimeline } from "@/components/orders/OrderTimeline";
import { Panel, Pill, fmtDate } from "@/components/account/ui";

export const metadata: Metadata = { title: "Detalle del pedido" };

/** Detalle de un pedido del cliente (solo si es de su correo verificado). Datos tal como quedaron al comprar. */
export default async function MyOrderDetail({ params }: { params: Promise<{ code: string }> }) {
  const c = await requireCustomerPage();
  const order = await findCustomerOrder(c, (await params).code);
  if (!order) notFound();
  const requests = await prisma.supportRequest.findMany({ where: { orderId: order.id, customerId: c.id }, orderBy: { createdAt: "desc" }, select: { code: true, type: true, status: true, createdAt: true } });
  const pay = paymentView(order.status, order.payments);
  const log = logisticsView(order.status);
  const site = carrierSite(order.carrier);
  const closed = order.status === "CANCELLED" || order.status === "EXPIRED";

  return (
    <>
      <Link href="/cuenta/pedidos" className="text-xs text-ink-soft underline-offset-4 hover:underline">← Mis pedidos</Link>
      <div className="relative overflow-hidden rounded-3xl bg-ink p-6 text-ivory shadow-lift sm:p-8">
        <div aria-hidden="true" className="iso-grid pointer-events-none absolute inset-0 opacity-60" />
        <div className="relative flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[.25em] text-gold-light">Pedido</p>
            <h1 className="mt-1 font-mono text-3xl tracking-wide">{order.publicCode}</h1>
            <p className="mt-2 text-sm text-ivory/70">Compra del {fmtDate(order.createdAt, true)}</p>
          </div>
          <div className="flex flex-wrap gap-2"><Pill tone={pay.tone}>{pay.label}</Pill><Pill tone={log.tone}>{log.label}</Pill></div>
        </div>
      </div>

      <Panel title="Seguimiento">
        {closed ? (
          <p className="text-sm text-ink-soft">{order.status === "EXPIRED" ? "Este pedido venció porque no se recibió el pago a tiempo." : "Este pedido fue cancelado."}</p>
        ) : (
          <OrderTimeline status={order.status.toLowerCase()} />
        )}
        <div className="mt-6 grid gap-3 text-sm sm:grid-cols-3">
          <div className="rounded-2xl bg-ivory/80 p-4"><p className="text-xs text-ink-soft">Transportadora</p><p className="mt-1 font-semibold">{order.carrier ?? "Aún sin asignar"}</p></div>
          <div className="rounded-2xl bg-ivory/80 p-4"><p className="text-xs text-ink-soft">Número de guía</p><p className="mt-1 font-mono font-semibold">{order.trackingNumber ?? "Se asigna al despachar"}</p>{site && order.trackingNumber && <a href={site} target="_blank" rel="noreferrer" className="mt-1 inline-block text-xs underline">Rastrear en {order.carrier}</a>}</div>
          <div className="rounded-2xl bg-ivory/80 p-4"><p className="text-xs text-ink-soft">Entrega estimada</p><p className="mt-1 font-semibold">{order.shippingEta ?? "—"}</p></div>
        </div>
      </Panel>

      <div className="grid gap-6 xl:grid-cols-[1.4fr_1fr]">
        <Panel title="Productos">
          <ul className="divide-y divide-ink/10">
            {order.items.map((i) => (
              <li key={i.id} className="flex items-center gap-4 py-3">
                <div className="relative size-16 shrink-0 overflow-hidden rounded-xl bg-ivory-200">{i.product?.images[0] && <Image src={i.product.images[0]} alt={i.name} fill sizes="64px" className="object-cover" />}</div>
                <div className="min-w-0 flex-1">
                  <p className="font-medium">{i.product ? <Link href={`/producto/${i.product.slug}`} className="hover:text-gold">{i.name}</Link> : i.name}</p>
                  <p className="text-xs text-ink-soft">{i.size ? `Talla ${i.size} · ` : ""}{i.quantity} × {formatCOP(i.unitPriceCOP)}</p>
                </div>
                <p className="text-sm font-semibold">{formatCOP(i.unitPriceCOP * i.quantity)}</p>
              </li>
            ))}
          </ul>
          <dl className="mt-3 space-y-1.5 border-t border-ink/10 pt-3 text-sm">
            <div className="flex justify-between"><dt className="text-ink-soft">Subtotal</dt><dd>{formatCOP(order.subtotalCOP)}</dd></div>
            <div className="flex justify-between"><dt className="text-ink-soft">Envío{order.shippingZone ? ` · ${order.shippingZone}` : ""}</dt><dd>{order.shippingCOP ? formatCOP(order.shippingCOP) : "Gratis"}</dd></div>
            <div className="flex justify-between text-base font-semibold"><dt>Total</dt><dd>{formatCOP(order.totalCOP)}</dd></div>
          </dl>
        </Panel>
        <div className="space-y-6">
          <Panel title="Entrega">
            <p className="text-sm font-medium">{order.customerFullName}</p>
            <p className="mt-1 text-sm text-ink-soft">{order.address}{order.notes ? ` · ${order.notes}` : ""}<br />{order.city}, {order.department}<br />Cel. {order.customerPhone}</p>
            <p className="mt-3 text-[11px] text-ink-soft">Dirección registrada al momento de la compra.</p>
          </Panel>
          <Panel title="Pago">
            <dl className="space-y-1.5 text-sm">
              <div className="flex justify-between"><dt className="text-ink-soft">Método</dt><dd>{PAYMENT_METHOD_LABEL[order.paymentMethod]}</dd></div>
              <div className="flex justify-between"><dt className="text-ink-soft">Estado</dt><dd><Pill tone={pay.tone}>{pay.label}</Pill></dd></div>
            </dl>
            {order.status === "PENDING_PAYMENT" && <Link href={`/pedido/${order.publicCode}`} className="mt-4 inline-block rounded-full bg-ink px-5 py-2.5 text-xs font-semibold text-ivory hover:bg-gold hover:text-ink">Completar el pago</Link>}
            <p className="mt-3 text-[11px] text-ink-soft">Nunca guardamos los datos de tu tarjeta.</p>
          </Panel>
        </div>
      </div>

      <Panel title="Solicitudes de este pedido" action={canRequestSupport(order.status) ? <Link href={`/cuenta/solicitudes/nueva?pedido=${order.publicCode}`} className="rounded-full bg-gold px-5 py-2.5 text-xs font-semibold text-ink hover:bg-gold-light">Solicitar soporte o devolución</Link> : undefined}>
        {requests.length === 0 ? <p className="text-sm text-ink-soft">No has creado solicitudes para este pedido.</p> : (
          <ul className="divide-y divide-ink/10">
            {requests.map((r) => (
              <li key={r.code} className="flex flex-wrap items-center justify-between gap-2 py-3 text-sm">
                <Link href={`/cuenta/solicitudes/${r.code}`} className="font-mono font-semibold hover:text-gold">{r.code}</Link>
                <span className="text-ink-soft">{SUPPORT_TYPES[r.type].label}</span>
                <Pill tone={SUPPORT_STATUS[r.status].tone}>{SUPPORT_STATUS[r.status].label}</Pill>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </>
  );
}
