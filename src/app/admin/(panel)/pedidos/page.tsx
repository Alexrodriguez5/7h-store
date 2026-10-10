import Link from "next/link";
import { requireAdminPage } from "@/lib/admin/guard";
import { listOrders } from "@/lib/services/admin-queries";
import { orderListQuery } from "@/lib/schemas/admin";
import { derivePaymentStatus, ORDER_STATUS_LABEL, PAYMENT_METHOD_LABEL } from "@/lib/order-status";
import { formatCOP } from "@/lib/format";
import { Badge, EmptyRow, OrderStatusBadge, PageHeader, PaymentBadge, btnGhost, btnPrimary, fmtDate, inputCls, labelCls, methodLabel, tdCls, thCls } from "@/components/admin/ui";

export const metadata = { title: "Pedidos" };

export default async function AdminOrdersPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requireAdminPage();
  const raw = await searchParams;
  const clean = Object.fromEntries(Object.entries(raw).map(([k, v]) => [k, Array.isArray(v) ? v[0] : v]).filter(([, v]) => v));
  const parsed = orderListQuery.safeParse(clean);
  const f = parsed.success ? parsed.data : { page: 1 as number };
  const { orders, total, pages } = await listOrders(f);

  const qs = (page: number) => {
    const p = new URLSearchParams(Object.entries(clean).filter(([k]) => k !== "page") as [string, string][]);
    if (page > 1) p.set("page", String(page));
    const s = p.toString();
    return `/admin/pedidos${s ? `?${s}` : ""}`;
  };
  const filtered = Object.keys(clean).some((k) => k !== "page");

  return (
    <>
      <PageHeader title="Pedidos" subtitle={`${total} pedido(s)${filtered ? " con los filtros aplicados" : ""}.`} />

      <form method="get" className="mb-6 grid gap-3 border border-ink/10 bg-white p-4 sm:grid-cols-2 lg:grid-cols-[2fr_1fr_1fr_1fr_1fr_auto]">
        <div><label htmlFor="q" className={labelCls}>Buscar</label><input id="q" name="q" defaultValue={clean.q} placeholder="Nº de pedido, nombre o correo" className={inputCls} /></div>
        <div><label htmlFor="status" className={labelCls}>Estado</label>
          <select id="status" name="status" defaultValue={clean.status ?? ""} className={inputCls}><option value="">Todos</option>{Object.entries(ORDER_STATUS_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></div>
        <div><label htmlFor="method" className={labelCls}>Método de pago</label>
          <select id="method" name="method" defaultValue={clean.method ?? ""} className={inputCls}><option value="">Todos</option>{Object.entries(PAYMENT_METHOD_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></div>
        <div><label htmlFor="from" className={labelCls}>Desde</label><input id="from" type="date" name="from" defaultValue={clean.from} className={inputCls} /></div>
        <div><label htmlFor="to" className={labelCls}>Hasta</label><input id="to" type="date" name="to" defaultValue={clean.to} className={inputCls} /></div>
        <div className="flex items-end gap-2"><button className={btnPrimary}>Filtrar</button>{filtered && <Link href="/admin/pedidos" className={btnGhost}>Limpiar</Link>}</div>
      </form>

      <div className="overflow-x-auto border border-ink/10 bg-white">
        <table className="w-full min-w-[980px]">
          <thead className="border-b border-ink/10"><tr>
            <th className={thCls}>Pedido</th><th className={thCls}>Cliente</th><th className={thCls}>Ciudad</th><th className={thCls}>Total</th><th className={thCls}>Método</th><th className={thCls}>Estado</th><th className={thCls}>Pago</th>
          </tr></thead>
          <tbody className="divide-y divide-ink/10">
            {orders.length === 0 && <EmptyRow cols={7}>{filtered ? "No hay pedidos con esos filtros." : "Todavía no hay pedidos."}</EmptyRow>}
            {orders.map((o) => (
              <tr key={o.id} className="hover:bg-ivory/60">
                <td className={tdCls}><Link href={`/admin/pedidos/${o.id}`} className="font-semibold underline-offset-4 hover:underline">{o.publicCode}</Link><p className="text-[11px] text-ink-soft">{fmtDate(o.createdAt)}</p></td>
                <td className={tdCls}>{o.customerFullName}<p className="text-[11px] text-ink-soft">{o.customerEmail}</p></td>
                <td className={tdCls}>{o.city}</td>
                <td className={`${tdCls} font-semibold`}>{formatCOP(o.totalCOP)}</td>
                <td className={tdCls}><Badge>{methodLabel(o.paymentMethod)}</Badge></td>
                <td className={tdCls}><OrderStatusBadge status={o.status} /></td>
                <td className={tdCls}><PaymentBadge status={derivePaymentStatus(o.payments)} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {pages > 1 && (
        <nav aria-label="Paginación" className="mt-6 flex items-center justify-between text-xs">
          {f.page > 1 ? <Link href={qs(f.page - 1)} className={btnGhost}>← Anterior</Link> : <span />}
          <span className="text-ink-soft">Página {f.page} de {pages}</span>
          {f.page < pages ? <Link href={qs(f.page + 1)} className={btnGhost}>Siguiente →</Link> : <span />}
        </nav>
      )}
    </>
  );
}
