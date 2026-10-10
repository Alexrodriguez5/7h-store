import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdminPage } from "@/lib/admin/guard";
import { getOrderDetail } from "@/lib/services/admin-queries";
import { derivePaymentStatus } from "@/lib/order-status";
import { formatCOP } from "@/lib/format";
import { OrderActions } from "@/components/admin/OrderActions";
import { Badge, Card, OrderStatusBadge, PageHeader, PaymentBadge, fmtDate, methodLabel } from "@/components/admin/ui";

export const metadata = { title: "Detalle de pedido" };

const Row = ({ k, v }: { k: string; v: React.ReactNode }) => (
  <div className="flex justify-between gap-4 py-1.5 text-sm"><dt className="text-ink-soft">{k}</dt><dd className="text-right">{v}</dd></div>
);

export default async function AdminOrderDetail({ params }: { params: Promise<{ id: string }> }) {
  await requireAdminPage();
  const order = await getOrderDetail((await params).id);
  if (!order) notFound();
  const manual = order.paymentMethod === "BANK_TRANSFER" || order.paymentMethod === "CASH_DEPOSIT";
  const approvedLate = (order.status === "EXPIRED" || order.status === "CANCELLED") && order.payments.some((p) => p.status === "APPROVED");

  return (
    <>
      <Link href="/admin/pedidos" className="text-xs text-ink-soft underline-offset-4 hover:underline">← Volver a pedidos</Link>
      <div className="mt-3"><PageHeader title={order.publicCode} subtitle={`Creado el ${fmtDate(order.createdAt)}`} action={<div className="flex gap-2"><OrderStatusBadge status={order.status} /><PaymentBadge status={derivePaymentStatus(order.payments)} /></div>} /></div>

      {approvedLate && <div role="alert" className="mb-6 border border-warning/50 bg-white p-4 text-sm"><strong className="text-warning">Atención:</strong> el pago fue aprobado pero el pedido está {order.status === "EXPIRED" ? "expirado" : "cancelado"} y su stock ya se liberó. Gestiona el reembolso o contacta al cliente.</div>}

      <div className="grid gap-6 xl:grid-cols-[1.5fr_1fr]">
        <div className="space-y-6">
          <Card title="Productos">
            <div className="-mx-5 overflow-x-auto">
              <table className="w-full min-w-[520px] text-sm">
                <thead><tr className="text-left text-[10px] uppercase tracking-widest text-ink-soft"><th className="px-5 py-2">Producto</th><th className="px-2 py-2">Talla</th><th className="px-2 py-2 text-right">Cant.</th><th className="px-2 py-2 text-right">Precio</th><th className="px-5 py-2 text-right">Subtotal</th></tr></thead>
                <tbody className="divide-y divide-ink/10">
                  {order.items.map((i) => (
                    <tr key={i.id}>
                      <td className="px-5 py-3">{i.product ? <Link href={`/producto/${i.product.slug}`} target="_blank" className="underline-offset-4 hover:underline">{i.name}</Link> : i.name}</td>
                      <td className="px-2 py-3">{i.size ?? "—"}</td>
                      <td className="px-2 py-3 text-right">{i.quantity}</td>
                      <td className="px-2 py-3 text-right">{formatCOP(i.unitPriceCOP)}</td>
                      <td className="px-5 py-3 text-right font-semibold">{formatCOP(i.unitPriceCOP * i.quantity)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <dl className="mt-4 border-t border-ink/10 pt-3">
              <Row k="Subtotal" v={formatCOP(order.subtotalCOP)} />
              <Row k="Envío" v={order.shippingCOP === 0 ? "Gratis" : formatCOP(order.shippingCOP)} />
              <Row k="Total" v={<strong className="text-base">{formatCOP(order.totalCOP)}</strong>} />
            </dl>
          </Card>

          <Card title="Pagos">
            {order.payments.length === 0 ? <p className="text-sm text-ink-soft">Sin registros de pago.</p> : (
              <ul className="divide-y divide-ink/10">
                {order.payments.map((p) => (
                  <li key={p.id} className="space-y-2 py-3 text-sm">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="flex items-center gap-2"><Badge>{p.provider === "wompi" ? "Wompi" : "Manual"}</Badge><PaymentBadge status={p.status} /></span>
                      <span className="text-xs text-ink-soft">{fmtDate(p.createdAt)}</span>
                    </div>
                    {p.providerRef && <p className="break-all text-[11px] text-ink-soft">Ref: {p.providerRef}</p>}
                    {p.proofUrl && (p.proofUrl.startsWith("data:image/")
                      // eslint-disable-next-line @next/next/no-img-element
                      ? <details><summary className="cursor-pointer text-xs underline">Ver comprobante</summary><img src={p.proofUrl} alt="Comprobante de pago" className="mt-2 max-h-96 border border-ink/10" /></details>
                      : <a href={p.proofUrl} download={`comprobante-${order.publicCode}.pdf`} className="text-xs underline">Descargar comprobante (PDF)</a>)}
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>

        <div className="space-y-6">
          <Card title="Gestionar pedido"><OrderActions orderId={order.id} status={order.status} isManualPayment={manual} /></Card>
          <Card title="Cliente">
            <dl>
              <Row k="Nombre" v={order.customerFullName} />
              <Row k="Correo" v={<a href={`mailto:${order.customerEmail}`} className="underline">{order.customerEmail}</a>} />
              <Row k="Teléfono" v={order.customerPhone} />
              <Row k="Documento" v={`${order.documentType} ${order.documentNumber}`} />
            </dl>
          </Card>
          <Card title="Envío">
            <dl>
              <Row k="Departamento" v={order.department} />
              <Row k="Ciudad" v={order.city} />
              <Row k="Dirección" v={order.address} />
              {order.notes && <Row k="Notas" v={order.notes} />}
              {order.carrier && <Row k="Transportadora" v={order.carrier} />}
              {order.trackingNumber && <Row k="Guía" v={order.trackingNumber} />}
            </dl>
          </Card>
          <Card title="Pago">
            <dl>
              <Row k="Método" v={methodLabel(order.paymentMethod)} />
              <Row k="Estado del pago" v={<PaymentBadge status={derivePaymentStatus(order.payments)} />} />
              <Row k="Estado del pedido" v={<OrderStatusBadge status={order.status} />} />
              {order.status === "PENDING_PAYMENT" && <Row k="Vence" v={fmtDate(order.expiresAt)} />}
            </dl>
          </Card>
        </div>
      </div>
    </>
  );
}
