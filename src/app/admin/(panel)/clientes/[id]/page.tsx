import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireAdminPage } from "@/lib/admin/guard";
import { SUPPORT_STATUS, SUPPORT_TYPES } from "@/lib/support";
import { formatCOP } from "@/lib/format";
import { CustomerBlockButton } from "@/components/admin/CustomerBlockButton";
import { Badge, Card, EmptyRow, OrderStatusBadge, PageHeader, fmtDate, tdCls, thCls } from "@/components/admin/ui";

export const metadata = { title: "Cliente" };

export default async function AdminCustomerDetail({ params }: { params: Promise<{ id: string }> }) {
  await requireAdminPage();
  const { id } = await params;
  const c = await prisma.customer.findUnique({
    where: { id },
    include: {
      identities: { select: { provider: true, createdAt: true } },
      addresses: { orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }] },
      supportRequests: { orderBy: { createdAt: "desc" }, select: { code: true, type: true, status: true, createdAt: true } },
      _count: { select: { sessions: true } },
    },
  });
  if (!c) notFound();
  const orders = await prisma.order.findMany({
    where: { customerEmail: c.email },
    orderBy: { createdAt: "desc" }, take: 50,
    select: { id: true, publicCode: true, createdAt: true, totalCOP: true, status: true },
  });
  const spent = orders.filter((o) => !["PENDING_PAYMENT", "CANCELLED", "EXPIRED"].includes(o.status)).reduce((s, o) => s + o.totalCOP, 0);

  return (
    <>
      <Link href="/admin/clientes" className="mb-4 inline-block text-xs text-ink-soft hover:underline">← Clientes</Link>
      <PageHeader title={c.name} subtitle={`${c.email} · cliente desde ${fmtDate(c.createdAt).split(",")[0]}`} action={<CustomerBlockButton id={c.id} blocked={Boolean(c.blockedAt)} />} />

      <div className="grid gap-6 xl:grid-cols-[1.5fr_1fr]">
        <div className="space-y-6">
          <Card title={`Pedidos (${orders.length}) · ${formatCOP(spent)} pagados`}>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[520px]">
                <thead className="border-b border-ink/10"><tr><th className={thCls}>Pedido</th><th className={thCls}>Fecha</th><th className={thCls}>Total</th><th className={thCls}>Estado</th></tr></thead>
                <tbody className="divide-y divide-ink/10">
                  {orders.length === 0 && <EmptyRow cols={4}>Sin pedidos con este correo.</EmptyRow>}
                  {orders.map((o) => (
                    <tr key={o.id}>
                      <td className={tdCls}><Link href={`/admin/pedidos/${o.id}`} className="font-semibold hover:underline">{o.publicCode}</Link></td>
                      <td className={tdCls}>{fmtDate(o.createdAt)}</td>
                      <td className={tdCls}>{formatCOP(o.totalCOP)}</td>
                      <td className={tdCls}><OrderStatusBadge status={o.status} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
          <Card title={`Solicitudes (${c.supportRequests.length})`}>
            {c.supportRequests.length === 0 ? <p className="text-sm text-ink-soft">Sin solicitudes.</p> : (
              <ul className="divide-y divide-ink/10">
                {c.supportRequests.map((r) => (
                  <li key={r.code} className="flex flex-wrap items-center justify-between gap-2 py-2.5 text-sm">
                    <Link href={`/admin/solicitudes/${r.code}`} className="font-mono font-semibold hover:underline">{r.code}</Link>
                    <span className="text-ink-soft">{SUPPORT_TYPES[r.type].label} · {fmtDate(r.createdAt).split(",")[0]}</span>
                    <Badge tone={SUPPORT_STATUS[r.status].tone}>{SUPPORT_STATUS[r.status].label}</Badge>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
        <div className="space-y-6">
          <Card title="Cuenta">
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between gap-2"><dt className="text-ink-soft">Correo</dt><dd>{c.emailVerifiedAt ? <Badge tone="success">Verificado</Badge> : <Badge tone="warning">Sin verificar</Badge>}</dd></div>
              <div className="flex justify-between gap-2"><dt className="text-ink-soft">Celular</dt><dd>{c.phone ?? "—"}</dd></div>
              <div className="flex justify-between gap-2"><dt className="text-ink-soft">Ingresa con</dt><dd className="text-right">{c.identities.map((i) => (i.provider === "google" ? "Google" : i.provider === "password" ? "Contraseña" : "Código")).join(", ") || "—"}</dd></div>
              <div className="flex justify-between gap-2"><dt className="text-ink-soft">Sesiones activas</dt><dd>{c._count.sessions}</dd></div>
              {c.blockedAt && <div className="flex justify-between gap-2"><dt className="text-ink-soft">Bloqueado</dt><dd>{fmtDate(c.blockedAt)}</dd></div>}
              {c.deletionRequestedAt && <div className="flex justify-between gap-2"><dt className="text-ink-soft">Pidió supresión</dt><dd className="text-warning">{fmtDate(c.deletionRequestedAt)}</dd></div>}
            </dl>
            {c.deletionRequestedAt && <p className="mt-3 rounded-xl bg-warning/5 p-3 text-[11px] leading-5">Solicitud de supresión (Ley 1581): responder en máximo 15 días hábiles. Los pedidos se conservan por obligación contable; los demás datos se eliminan manualmente tras revisarla.</p>}
          </Card>
          <Card title={`Direcciones (${c.addresses.length})`}>
            {c.addresses.length === 0 ? <p className="text-sm text-ink-soft">Sin direcciones guardadas.</p> : (
              <ul className="space-y-3 text-sm">
                {c.addresses.map((a) => <li key={a.id}><p className="font-semibold">{a.label} {a.isDefault && <Badge tone="gold">Principal</Badge>}</p><p className="text-ink-soft">{a.fullName} · {a.phone}<br />{a.address}{a.neighborhood ? `, ${a.neighborhood}` : ""}, {a.city}, {a.department}</p></li>)}
              </ul>
            )}
          </Card>
        </div>
      </div>
    </>
  );
}
