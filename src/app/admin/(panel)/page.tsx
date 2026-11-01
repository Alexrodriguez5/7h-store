import Link from "next/link";
import { requireAdminPage } from "@/lib/admin/guard";
import { getDashboard, getSalesAnalytics } from "@/lib/services/admin-queries";
import { ORDER_STATUS_LABEL, PAYMENT_METHOD_LABEL } from "@/lib/order-status";
import { Kpi, RankBars, SalesTrend } from "@/components/admin/charts";
import { derivePaymentStatus } from "@/lib/order-status";
import { formatCOP } from "@/lib/format";
import { Card, EmptyRow, OrderStatusBadge, PageHeader, PaymentBadge, Stat, fmtDate, tdCls, thCls } from "@/components/admin/ui";

const PERIODS = [7, 30, 90] as const;

export default async function AdminDashboard({ searchParams }: { searchParams: Promise<{ periodo?: string }> }) {
  await requireAdminPage();
  const { periodo } = await searchParams;
  const days = PERIODS.find((p) => String(p) === periodo) ?? 30;
  // Secuencial a propósito: cada servidor usa una sola conexión a la base de datos.
  const d = await getDashboard();
  const a = await getSalesAnalytics(days);
  const pct = (part: number, total: number) => (total ? `${Math.round((part / total) * 100)}%` : "—");

  return (
    <>
      <PageHeader title="Dashboard" subtitle="Resumen de la operación de 7H STORE." />

      {d.lateApprovals.length > 0 && (
        <div role="alert" className="mb-6 rounded-2xl border border-warning/50 bg-white p-4 text-sm shadow-soft">
          <strong className="text-warning">Requiere atención:</strong> hay {d.lateApprovals.length} pago(s) aprobado(s) en pedidos vencidos o cancelados (
          {d.lateApprovals.map((o, i) => (
            <span key={o.id}>{i > 0 && ", "}<Link href={`/admin/pedidos/${o.id}`} className="underline">{o.publicCode}</Link></span>
          ))}
          ). Revisa si corresponde reembolsar o reactivar el pedido.
        </div>
      )}

      {d.proofsToReview.length > 0 && (
        <div role="status" className="mb-6 rounded-2xl border border-gold/60 bg-white p-4 text-sm shadow-soft">
          <strong>Comprobantes por revisar ({d.proofsToReview.length}):</strong>{" "}
          {d.proofsToReview.map((o, i) => (
            <span key={o.id}>{i > 0 && ", "}<Link href={`/admin/pedidos/${o.id}`} className="underline">{o.publicCode}</Link></span>
          ))}
          . Verifica el dinero en la cuenta y confirma el pago antes de que el pedido expire.
        </div>
      )}

      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-display text-2xl">Rendimiento</h2>
        <nav aria-label="Periodo" className="flex gap-1 rounded-full border border-ink/10 bg-white p-1 text-xs shadow-soft">
          {PERIODS.map((p) => (
            <Link key={p} href={p === 30 ? "/admin" : `/admin?periodo=${p}`} aria-current={p === days ? "page" : undefined} className={`rounded-full px-3.5 py-1.5 font-medium transition-colors ${p === days ? "bg-ink text-ivory" : "text-ink-soft hover:text-ink"}`}>
              {p === 7 ? "7 días" : p === 30 ? "30 días" : "90 días"}
            </Link>
          ))}
        </nav>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Kpi label="Ventas confirmadas" value={formatCOP(a.current.salesCOP)} current={a.current.salesCOP} previous={a.previous.salesCOP} hint={`vs. ${days} días anteriores`} />
        <Kpi label="Pedidos pagados" value={String(a.current.orders)} current={a.current.orders} previous={a.previous.orders} hint={`${a.current.units} unidades vendidas`} />
        <Kpi label="Ticket promedio" value={a.current.orders ? formatCOP(a.current.avgTicketCOP) : "—"} current={a.current.orders ? a.current.avgTicketCOP : undefined} previous={a.current.orders ? a.previous.avgTicketCOP : undefined} />
        <Kpi label="Pedidos que se pagan" value={a.paidRate === null ? "—" : `${a.paidRate}%`} hint={`${a.current.createdOrders} pedido(s) creados`} />
      </div>

      <Card title={`Ventas por día · últimos ${days} días`} className="mt-6">
        <SalesTrend data={a.daily} />
        <details className="mt-3 text-xs">
          <summary className="cursor-pointer text-ink-soft hover:text-ink">Ver como tabla</summary>
          <div className="mt-2 max-h-56 overflow-auto">
            <table className="w-full">
              <thead><tr><th className={thCls}>Día</th><th className={thCls}>Pedidos</th><th className={thCls}>Ventas</th></tr></thead>
              <tbody className="divide-y divide-ink/10">
                {[...a.daily].reverse().filter((x) => x.orders > 0).map((x) => <tr key={x.day}><td className={tdCls}>{x.day}</td><td className={tdCls}>{x.orders}</td><td className={tdCls}>{formatCOP(x.totalCOP)}</td></tr>)}
                {a.daily.every((x) => x.orders === 0) && <EmptyRow cols={3}>Sin ventas confirmadas en este periodo.</EmptyRow>}
              </tbody>
            </table>
          </div>
        </details>
      </Card>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <Card title="Productos más vendidos">
          <RankBars rows={a.topProducts.map((p) => ({ label: p.name, value: p.salesCOP, detail: `${p.units} unidad(es)` }))} />
        </Card>
        <Card title="Ventas por método de pago">
          <RankBars rows={a.byMethod.map((m) => ({ label: PAYMENT_METHOD_LABEL[m.method as keyof typeof PAYMENT_METHOD_LABEL] ?? m.method, value: m.salesCOP, detail: `${m.orders} pedido(s) · ${pct(m.salesCOP, a.current.salesCOP)} de las ventas` }))} />
        </Card>
        <Card title="Ventas por departamento">
          <RankBars rows={a.topDepartments.map((x) => ({ label: x.department, value: x.salesCOP, detail: `${x.orders} pedido(s)` }))} />
        </Card>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_2fr]">
        <Card title={`Pedidos por estado · ${days} días`}>
          <RankBars unit="count" rows={a.byStatus.map((x) => ({ label: ORDER_STATUS_LABEL[x.status as keyof typeof ORDER_STATUS_LABEL] ?? x.status, value: x.orders, detail: pct(x.orders, a.current.createdOrders) + " de los pedidos" }))} empty="Sin pedidos en este periodo." />
        </Card>
        <div className="grid grid-cols-2 gap-4 self-start sm:grid-cols-4">
          <Stat label="Pendientes de pago" value={d.pending} href="/admin/pedidos?status=PENDING_PAYMENT" tone={d.pending ? "warn" : undefined} />
          <Stat label="Por preparar" value={d.paid} href="/admin/pedidos?status=PAID" />
          <Stat label="Preparando" value={d.processing} href="/admin/pedidos?status=PROCESSING" />
          <Stat label="Enviados" value={d.shipped} href="/admin/pedidos?status=SHIPPED" />
          <Stat label="Entregados" value={d.delivered} href="/admin/pedidos?status=DELIVERED" />
          <Stat label="Total de pedidos" value={d.totalOrders} href="/admin/pedidos" />
          <Stat label="Productos activos" value={d.activeProducts} href="/admin/productos" />
          <Stat label="Agotados" value={d.soldOut.length} href="/admin/inventario?f=agotados" tone={d.soldOut.length ? "warn" : undefined} />
          <p className="col-span-2 text-[11px] leading-5 text-ink-soft sm:col-span-4">Ventas confirmadas = pedidos pagados, preparando, enviados y entregados. Desde el inicio: {formatCOP(d.salesCOP)} en {d.paidOrders} pedido(s). Los pagos en modo de prueba no cuentan como venta.</p>
        </div>
      </div>

      <div className="mt-8 grid gap-6 xl:grid-cols-[1.6fr_1fr]">
        <Card title="Pedidos recientes">
          <div className="-mx-5 overflow-x-auto">
            <table className="w-full min-w-[560px]">
              <thead><tr><th className={thCls}>Pedido</th><th className={thCls}>Cliente</th><th className={thCls}>Total</th><th className={thCls}>Estado</th><th className={thCls}>Pago</th></tr></thead>
              <tbody className="divide-y divide-ink/10">
                {d.recent.length === 0 && <EmptyRow cols={5}>Aún no hay pedidos.</EmptyRow>}
                {d.recent.map((o) => (
                  <tr key={o.id}>
                    <td className={tdCls}><Link href={`/admin/pedidos/${o.id}`} className="font-semibold underline-offset-4 hover:underline">{o.publicCode}</Link><p className="text-[11px] text-ink-soft">{fmtDate(o.createdAt)}</p></td>
                    <td className={tdCls}>{o.customerFullName}</td>
                    <td className={tdCls}>{formatCOP(o.totalCOP)}</td>
                    <td className={tdCls}><OrderStatusBadge status={o.status} /></td>
                    <td className={tdCls}><PaymentBadge status={derivePaymentStatus(o.payments)} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        <div className="space-y-6">
          <Card title="Productos agotados">
            {d.soldOut.length === 0 ? <p className="text-sm text-ink-soft">Ninguno. Todo tiene stock.</p> : (
              <ul className="space-y-2 text-sm">{d.soldOut.slice(0, 8).map((p) => <li key={p.id}><Link href={`/admin/productos/${p.id}/editar`} className="underline-offset-4 hover:underline">{p.name}</Link></li>)}</ul>
            )}
          </Card>
          <Card title="Bajo stock">
            {d.lowStock.length === 0 ? <p className="text-sm text-ink-soft">Sin alertas de bajo stock.</p> : (
              <ul className="space-y-2 text-sm">{d.lowStock.slice(0, 8).map((p) => <li key={p.id} className="flex justify-between gap-3"><Link href={`/admin/productos/${p.id}/editar`} className="underline-offset-4 hover:underline">{p.name}</Link><span className="text-ink-soft">{p.total} u.</span></li>)}</ul>
            )}
          </Card>
        </div>
      </div>
    </>
  );
}
