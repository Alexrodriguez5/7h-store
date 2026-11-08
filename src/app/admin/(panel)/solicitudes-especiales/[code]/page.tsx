import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireAdminPage } from "@/lib/admin/guard";
import { formatCOP } from "@/lib/format";
import { REQUEST_STATUS, REQUEST_STATUS_ORDER } from "@/lib/services/product-requests";
import { PRICE_KIND, syncOffers } from "@/lib/services/special-requests";
import { Badge, Card, PageHeader, fmtDate } from "@/components/admin/ui";
import { RequestWorkspace, type WorkspaceData } from "@/components/admin/RequestWorkspace";

export const metadata = { title: "Expediente de solicitud" };

/** Expediente completo de una solicitud especial (solo equipo). */
export default async function RequestFile({ params }: { params: Promise<{ code: string }> }) {
  await requireAdminPage();
  await syncOffers().catch(() => undefined);
  const { code } = await params;
  const r = await prisma.productRequest.findUnique({
    where: { code: code.slice(0, 30) },
    include: {
      images: { orderBy: { position: "asc" } },
      events: { orderBy: { createdAt: "asc" } },
      alternatives: { orderBy: [{ round: "asc" }, { position: "asc" }] },
      offers: { orderBy: { createdAt: "desc" }, include: { product: { select: { slug: true, name: true } } } },
      accessTokens: { where: { revokedAt: null, expiresAt: { gt: new Date() } }, select: { id: true } },
      auraConversation: { select: { id: true, createdAt: true, messageCount: true, messages: { orderBy: { createdAt: "asc" }, take: 80, select: { id: true, role: true, text: true, tools: true, redacted: true, attachments: true, errorKind: true, createdAt: true } } } },
    },
  });
  if (!r) notFound();
  const admins = await prisma.adminUser.findMany({ where: { active: true }, select: { id: true, name: true }, orderBy: { name: "asc" } });
  const categories = await prisma.category.findMany({ where: { active: true }, select: { slug: true, label: true }, orderBy: { label: "asc" } });
  const orders = r.offers.filter((o) => o.orderId).length ? await prisma.order.findMany({ where: { id: { in: r.offers.map((o) => o.orderId!).filter(Boolean) } }, select: { id: true, publicCode: true, status: true } }) : [];
  const adminName = new Map(admins.map((a) => [a.id, a.name]));

  const data: WorkspaceData = {
    id: r.id, code: r.code, status: r.status, assignedAdminId: r.assignedAdminId,
    structured: { productName: r.productName, brand: r.brand, model: r.model, color: r.color, size: r.size, features: r.features, referenceStore: r.referenceStore, budgetCOP: r.budgetCOP, phone: r.phone },
    alternatives: r.alternatives.map((a) => ({ ...a, validUntil: a.validUntil?.toISOString().slice(0, 10) ?? null, sentAt: a.sentAt?.toISOString() ?? null, respondedAt: a.respondedAt?.toISOString() ?? null, createdAt: a.createdAt.toISOString(), updatedAt: a.updatedAt.toISOString() })),
    admins, categories,
    statuses: REQUEST_STATUS_ORDER.filter((s) => s !== "CONVERTIDA").map((s) => ({ value: s, label: REQUEST_STATUS[s].label })),
    activeLinks: r.accessTokens.length,
  };

  return (
    <>
      <PageHeader title={r.productName} subtitle={`${r.code} · creada ${fmtDate(r.createdAt)} · actualizada ${fmtDate(r.updatedAt)}`} action={<Link href="/admin/solicitudes-especiales" className="text-sm underline">← Volver</Link>} />
      <div className="mb-5 flex flex-wrap items-center gap-2">
        <Badge tone={r.status === "CONVERTIDA" ? "success" : r.status === "ACEPTADA" ? "gold" : "warning"}>{REQUEST_STATUS[r.status].label}</Badge>
        <Badge>{r.source ?? "formulario"}</Badge>
        {r.assignedAdminId && <Badge tone="gold">Responsable: {adminName.get(r.assignedAdminId) ?? "—"}</Badge>}
        {r.auraPriority && <Badge tone={r.auraPriority === "alta" ? "warning" : "neutral"}>Prioridad sugerida: {r.auraPriority}</Badge>}
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_1.15fr]">
        <div className="space-y-6">
          <Card title="Cliente">
            <dl className="grid grid-cols-[110px_1fr] gap-y-2 text-sm">
              <dt className="text-ink-soft">Nombre</dt><dd>{r.name}</dd>
              <dt className="text-ink-soft">Correo</dt><dd><a href={`mailto:${r.email}`} className="underline">{r.email}</a></dd>
              <dt className="text-ink-soft">Teléfono</dt><dd>{r.phone ?? "—"}</dd>
              <dt className="text-ink-soft">Cuenta</dt><dd>{r.customerId ? "Sí (con sesión)" : "Invitado · enlace seguro"}</dd>
            </dl>
          </Card>

          {r.auraSummary && (
            <Card title="Resumen de AURA">
              <p className="text-sm leading-6">{r.auraSummary}</p>
              <dl className="mt-3 grid grid-cols-[110px_1fr] gap-y-1.5 text-sm">
                <dt className="text-ink-soft">Producto</dt><dd>{r.productName}</dd>
                <dt className="text-ink-soft">Marca / modelo</dt><dd>{[r.brand, r.model].filter(Boolean).join(" · ") || "Pendiente"}</dd>
                <dt className="text-ink-soft">Talla / color</dt><dd>{[r.size, r.color].filter(Boolean).join(" · ") || "Pendiente"}</dd>
                <dt className="text-ink-soft">Presupuesto</dt><dd>{r.budgetCOP != null ? formatCOP(r.budgetCOP) : "Pendiente"}</dd>
                <dt className="text-ink-soft">Pendiente</dt><dd>{r.auraPending.length ? r.auraPending.join(", ") : "Nada"}</dd>
                <dt className="text-ink-soft">Adjuntos</dt><dd>{r.images.length} foto(s) · {r.links.length} enlace(s)</dd>
              </dl>
              <p className="mt-3 text-[11px] text-ink-soft">Lo preparó AURA con lo que escribió el cliente (sin datos personales) y el cliente lo confirmó. Las fotos no se enviaron a la IA. Verifica antes de cotizar.</p>
            </Card>
          )}

          <Card title="Descripción original del cliente (no se edita)">
            <pre className="whitespace-pre-wrap font-sans text-sm leading-6">{r.originalText ?? [r.productName, r.brand, r.model, r.comments].filter(Boolean).join("\n")}</pre>
          </Card>

          {(r.images.length > 0 || r.imagePath) && (
            <Card title="Fotografías">
              <div className="flex flex-wrap gap-3">
                {r.images.map((img) => (
                  <a key={img.id} href={`/media/busquedas/${img.id}`} target="_blank" rel="noreferrer" className="block size-28 overflow-hidden rounded-xl ring-1 ring-ink/10">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={`/media/busquedas/${img.id}`} alt="Foto de referencia" className="size-full object-cover" />
                  </a>
                ))}
                {r.imagePath && (
                  <a href={`/media/solicitudes/${r.id}`} target="_blank" rel="noreferrer" className="block size-28 overflow-hidden rounded-xl ring-1 ring-ink/10">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={`/media/solicitudes/${r.id}`} alt="Foto de referencia" className="size-full object-cover" />
                  </a>
                )}
              </div>
            </Card>
          )}

          {r.links.length > 0 && (
            <Card title="Enlaces de referencia">
              <p className="mb-2 text-[11px] text-ink-soft">Los envió el cliente. El servidor nunca los abre; ábrelos tú con precaución (no inicies sesión en sitios desconocidos).</p>
              <ul className="space-y-1.5 text-sm">
                {r.links.map((l) => <li key={l} className="break-all"><a href={l} target="_blank" rel="noopener noreferrer nofollow" referrerPolicy="no-referrer" className="underline">{l}</a></li>)}
              </ul>
            </Card>
          )}

          {r.auraConversation && (
            <Card title={`Conversación con AURA (${r.auraConversation.messages.length} mensajes)`}>
              <details>
                <summary className="cursor-pointer text-sm font-semibold">Ver la conversación completa</summary>
                <ol className="mt-3 max-h-[420px] space-y-2 overflow-y-auto text-sm">
                  {r.auraConversation.messages.map((m) => (
                    <li key={m.id} className={`rounded-xl px-3 py-2 ${m.role === "user" ? "bg-gold/10" : m.role === "model" ? "bg-ink/[.04]" : "border border-ink/10 text-ink-soft"}`}>
                      <span className="block text-[11px] text-ink-soft">
                        {m.role === "user" ? "Cliente" : m.role === "model" ? "AURA (IA)" : "Sistema"} · {fmtDate(m.createdAt)}
                        {m.tools.length > 0 && ` · herramientas: ${m.tools.join(", ")}`}
                        {m.redacted && " · datos privados ocultados"}
                        {m.attachments > 0 && ` · ${m.attachments} adjunto(s)`}
                        {m.errorKind && ` · sin respuesta de IA (${m.errorKind})`}
                      </span>
                      <span className="whitespace-pre-wrap">{m.text}</span>
                    </li>
                  ))}
                </ol>
              </details>
            </Card>
          )}

          <Card title="Historial y conversación">
            <ol className="space-y-2">
              {r.events.map((e) => (
                <li key={e.id} className={`rounded-xl p-3 text-sm ${e.internal ? "border border-dashed border-warning/50 bg-warning/5" : e.authorType === "customer" ? "bg-ivory/70" : e.kind === "status" ? "bg-white" : "bg-ink text-ivory"}`}>
                  <p className={`text-[11px] font-semibold ${e.authorType === "admin" && !e.internal && e.kind !== "status" ? "text-gold-light" : "text-ink-soft"}`}>
                    {e.internal ? "Nota interna" : e.authorType === "customer" ? r.name : e.authorType === "system" ? "Sistema" : "7H STORE"}
                    {e.adminId ? ` · ${adminName.get(e.adminId) ?? ""}` : ""} · {fmtDate(e.createdAt)} · {e.kind}
                    {e.toStatus ? ` → ${REQUEST_STATUS[e.toStatus].label}` : ""}
                  </p>
                  {e.body && <p className="mt-1 whitespace-pre-line">{e.kind === "reminder" ? "Aviso de cotización por vencer enviado." : e.body}</p>}
                </li>
              ))}
            </ol>
          </Card>

          {r.offers.length > 0 && (
            <Card title="Ofertas de compra">
              <ul className="space-y-2 text-sm">
                {r.offers.map((o) => {
                  const ord = orders.find((x) => x.id === o.orderId);
                  return (
                    <li key={o.id} className="rounded-xl border border-ink/10 p-3">
                      <p className="font-semibold">{o.product.name} · {formatCOP(o.priceCOP)}</p>
                      <p className="text-xs text-ink-soft">Estado: {o.status} · vence {fmtDate(o.expiresAt)} · solo para {o.customerEmail}</p>
                      {ord && <p className="mt-1 text-xs">Pedido <Link href={`/admin/pedidos/${ord.id}`} className="underline">{ord.publicCode}</Link> · {ord.status}</p>}
                    </li>
                  );
                })}
              </ul>
            </Card>
          )}
        </div>

        <RequestWorkspace data={data} priceKinds={Object.fromEntries(Object.entries(PRICE_KIND).map(([k, v]) => [k, v.label]))} />
      </div>
    </>
  );
}
