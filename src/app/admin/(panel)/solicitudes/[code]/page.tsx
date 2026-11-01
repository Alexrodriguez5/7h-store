import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireAdminPage } from "@/lib/admin/guard";
import { SUPPORT_STATUS, SUPPORT_STATUS_ORDER, SUPPORT_TYPES } from "@/lib/support";
import { formatCOP } from "@/lib/format";
import { SupportStaffPanel } from "@/components/admin/SupportStaffPanel";
import { Badge, Card, PageHeader, fmtDate } from "@/components/admin/ui";

export const metadata = { title: "Solicitud" };

const KIND: Record<string, string> = { created: "Solicitud creada", status: "Cambio de estado", message: "Mensaje", note: "Nota interna", assigned: "Asignación", refund: "Reembolso registrado", email_in: "Correo recibido" };

export default async function AdminSupportDetail({ params }: { params: Promise<{ code: string }> }) {
  await requireAdminPage();
  const { code } = await params;
  const [r, admins] = await Promise.all([
    prisma.supportRequest.findUnique({
      where: { code },
      include: {
        customer: { select: { id: true, name: true, email: true, phone: true, blockedAt: true } },
        order: { select: { id: true, publicCode: true, status: true, totalCOP: true, createdAt: true, carrier: true, trackingNumber: true } },
        items: { include: { orderItem: { select: { name: true, size: true, quantity: true, unitPriceCOP: true } } } },
        attachments: { select: { id: true, fileName: true, mime: true, size: true, uploadedBy: true, createdAt: true }, orderBy: { createdAt: "asc" } },
        events: { orderBy: { createdAt: "asc" } },
      },
    }),
    prisma.adminUser.findMany({ where: { active: true }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
  ]);
  if (!r) notFound();
  const adminName = new Map(admins.map((a) => [a.id, a.name]));
  const st = SUPPORT_STATUS[r.status];
  const info = SUPPORT_TYPES[r.type];

  return (
    <>
      <Link href="/admin/solicitudes" className="mb-4 inline-block text-xs text-ink-soft hover:underline">← Solicitudes</Link>
      <PageHeader title={r.code} subtitle={`${info.label} · creada ${fmtDate(r.createdAt)}`} action={<Badge tone={st.tone}>{st.label}</Badge>} />

      <div className="grid gap-6 xl:grid-cols-[1.5fr_1fr]">
        <div className="space-y-6">
          <Card title="Caso">
            <p className="font-semibold">{r.reason}</p>
            <p className="mt-2 whitespace-pre-line text-sm leading-6">{r.description}</p>
            {r.items.length > 0 && (
              <ul className="mt-4 space-y-1 text-sm">
                {r.items.map((i) => <li key={i.id}>• {i.orderItem.name}{i.orderItem.size ? ` (${i.orderItem.size})` : ""} — {i.quantity} de {i.orderItem.quantity} · {formatCOP(i.orderItem.unitPriceCOP)} c/u</li>)}
              </ul>
            )}
            <p className="mt-4 rounded-xl bg-ivory p-3 text-[11px] leading-5 text-ink-soft">{info.legal}</p>
          </Card>

          <Card title="Historial completo (las notas internas solo las ve el equipo)">
            <ol className="space-y-3">
              {r.events.map((e) => (
                <li key={e.id} className={`rounded-xl p-3 text-sm ${!e.visibleToCustomer ? "border border-dashed border-warning/50 bg-warning/5" : e.authorType === "customer" ? "bg-gold/10" : e.authorType === "admin" ? "bg-ink/[.04]" : "bg-ivory"}`}>
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-ink-soft">
                    {KIND[e.kind] ?? e.kind} · {e.authorType === "admin" ? adminName.get(e.adminId ?? "") ?? "Equipo" : e.authorType === "customer" ? "Cliente" : "Sistema"} · {fmtDate(e.createdAt)}
                    {!e.visibleToCustomer && " · privado"}
                  </p>
                  {e.kind === "status" && e.toStatus && <p className="mt-1">{e.fromStatus ? `${SUPPORT_STATUS[e.fromStatus].label} → ` : ""}<strong>{SUPPORT_STATUS[e.toStatus].label}</strong></p>}
                  {e.kind === "assigned" && <p className="mt-1">{e.body === "sin asignar" ? "Sin asignar" : `Asignada a ${adminName.get(e.body ?? "") ?? "otra persona"}`}</p>}
                  {e.body && e.kind !== "assigned" && <p className="mt-1 whitespace-pre-line leading-6">{e.body}</p>}
                </li>
              ))}
            </ol>
          </Card>

          <Card title={`Evidencias (${r.attachments.length})`}>
            {r.attachments.length === 0 ? <p className="text-sm text-ink-soft">Sin archivos.</p> : (
              <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {r.attachments.map((a) => (
                  <li key={a.id}>
                    <a href={`/api/cuenta/adjuntos/${a.id}`} target="_blank" rel="noreferrer" className="block overflow-hidden rounded-xl border border-ink/10 bg-ivory text-[11px]">
                      {a.mime.startsWith("image/") && a.mime !== "image/heic" ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={`/api/cuenta/adjuntos/${a.id}`} alt={a.fileName} className="aspect-square w-full object-cover" loading="lazy" />
                      ) : <span className="grid aspect-square place-items-center p-2 text-center">{a.fileName}</span>}
                      <span className="block truncate px-2 py-1 text-ink-soft">{(a.size / 1024).toFixed(0)} KB · {fmtDate(a.createdAt).split(",")[0]}</span>
                    </a>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>

        <div className="space-y-6">
          <Card title="Gestionar">
            <SupportStaffPanel
              code={r.code}
              status={r.status}
              statuses={SUPPORT_STATUS_ORDER.map((s) => ({ key: s, label: SUPPORT_STATUS[s].label }))}
              admins={admins}
              assignedAdminId={r.assignedAdminId}
              resolution={r.resolution ?? ""}
              refundAmountCOP={r.refundAmountCOP}
              refundReference={r.refundReference ?? ""}
              orderTotalCOP={r.order.totalCOP}
            />
          </Card>
          <Card title="Cliente">
            <p className="font-semibold">{r.customer.name} {r.customer.blockedAt && <Badge tone="error">Bloqueado</Badge>}</p>
            <p className="text-sm">{r.contactEmail}</p>
            {(r.contactPhone || r.customer.phone) && <p className="text-sm">{r.contactPhone || r.customer.phone}</p>}
            <Link href={`/admin/clientes/${r.customer.id}`} className="mt-2 inline-block text-xs underline">Ver ficha del cliente</Link>
          </Card>
          <Card title="Pedido">
            <Link href={`/admin/pedidos/${r.order.id}`} className="font-semibold underline-offset-4 hover:underline">{r.order.publicCode}</Link>
            <p className="text-sm">{formatCOP(r.order.totalCOP)} · {fmtDate(r.order.createdAt)}</p>
            {r.order.trackingNumber && <p className="text-sm">{r.order.carrier} · guía {r.order.trackingNumber}</p>}
          </Card>
          {r.dueAt && !st.final && (
            <Card title="Plazo orientativo">
              <p className={`text-sm ${r.dueAt < new Date() ? "font-semibold text-error" : ""}`}>Responder antes del {fmtDate(r.dueAt)}</p>
              <p className="mt-1 text-[11px] text-ink-soft">{info.responseDays} días hábiles (sin contar festivos).</p>
            </Card>
          )}
        </div>
      </div>
    </>
  );
}
