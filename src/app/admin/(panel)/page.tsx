import Link from "next/link";
import { requireAdminPage } from "@/lib/admin/guard";
import { getDashboard } from "@/lib/services/admin-queries";
import { derivePaymentStatus } from "@/lib/order-status";
import { formatCOP } from "@/lib/format";
import { Card, EmptyRow, OrderStatusBadge, PageHeader, PaymentBadge, Stat, fmtDate, tdCls, thCls } from "@/components/admin/ui";

export default async function AdminDashboard() {
  await requireAdminPage();
  const d = await getDashboard();

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

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat label="Total de pedidos" value={d.totalOrders} href="/admin/pedidos" />
        <Stat label="Pendientes de pago" value={d.pending} href="/admin/pedidos?status=PENDING_PAYMENT" />
        <Stat label="Pagados" value={d.paid} href="/admin/pedidos?status=PAID" />
        <Stat label="Preparando" value={d.processing} href="/admin/pedidos?status=PROCESSING" />
        <Stat label="Enviados" value={d.shipped} href="/admin/pedidos?status=SHIPPED" />
        <Stat label="Entregados" value={d.delivered} href="/admin/pedidos?status=DELIVERED" />
        <Stat label="Productos activos" value={d.activeProducts} href="/admin/productos" />
        <Stat label="Productos agotados" value={d.soldOut.length} href="/admin/inventario?f=agotados" tone={d.soldOut.length ? "warn" : undefined} />
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-3">
        <Stat label="Ventas últimos 30 días" value={formatCOP(d.sales30COP)} />
        <Stat label="Ventas confirmadas (total)" value={formatCOP(d.salesCOP)} />
        <Stat label="Ticket promedio" value={d.paidOrders ? formatCOP(d.avgTicketCOP) : "—"} />
      </div>
      <p className="mt-2 text-[11px] text-ink-soft">Ventas confirmadas = pedidos pagados, preparando, enviados y entregados ({d.paidOrders} en total, {d.paidOrders30} en los últimos 30 días).</p>

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
