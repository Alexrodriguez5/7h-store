import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { getCurrentCustomer } from "@/lib/customer/auth";
import { SUPPORT_STATUS, SUPPORT_TYPES } from "@/lib/support";
import { formatCOP } from "@/lib/format";
import { SupportReplyForm } from "@/components/account/SupportReplyForm";
import { Notice, Panel, Pill, fmtDate } from "@/components/account/ui";

export const metadata: Metadata = { title: "Solicitud" };

/** Detalle de una solicitud: solo eventos visibles para el cliente (las notas internas nunca se consultan aquí). */
export default async function MyRequestDetail({ params, searchParams }: { params: Promise<{ code: string }>; searchParams: Promise<{ nueva?: string }> }) {
  const c = (await getCurrentCustomer())!;
  const [{ code }, sp] = await Promise.all([params, searchParams]);
  const r = await prisma.supportRequest.findFirst({
    where: { code, customerId: c.id },
    include: {
      order: { select: { publicCode: true } },
      items: { include: { orderItem: { select: { name: true, size: true } } } },
      attachments: { select: { id: true, fileName: true, mime: true, createdAt: true }, orderBy: { createdAt: "asc" } },
      events: { where: { visibleToCustomer: true }, orderBy: { createdAt: "asc" }, select: { id: true, kind: true, toStatus: true, body: true, authorType: true, createdAt: true } },
    },
  });
  if (!r) notFound();
  const st = SUPPORT_STATUS[r.status];
  const info = SUPPORT_TYPES[r.type];

  return (
    <>
      <Link href="/cuenta/solicitudes" className="text-xs text-ink-soft underline-offset-4 hover:underline">← Solicitudes</Link>
      {sp.nueva && <Notice tone="success">Radicamos tu solicitud <strong>{r.code}</strong>. Te enviamos la confirmación al correo.</Notice>}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-mono text-3xl font-semibold tracking-wide">{r.code}</h1>
          <p className="mt-1 text-sm text-ink-soft">{info.label} · Pedido <Link href={`/cuenta/pedidos/${r.order.publicCode}`} className="underline">{r.order.publicCode}</Link> · {fmtDate(r.createdAt, true)}</p>
        </div>
        <Pill tone={st.tone}>{st.label}</Pill>
      </div>
      {r.status === "INFO_SOLICITADA" && <Notice>El equipo necesita más información. Respóndela abajo para continuar con tu caso.</Notice>}

      <div className="grid gap-6 xl:grid-cols-[1.4fr_1fr]">
        <Panel title="Historial">
          <ol className="space-y-4">
            {r.events.map((e) => (
              <li key={e.id} className={`rounded-2xl p-4 text-sm ${e.authorType === "admin" ? "bg-ink text-ivory" : e.authorType === "system" ? "bg-ivory/80 text-ink-soft" : "bg-gold/10"}`}>
                <p className={`text-[11px] font-semibold uppercase tracking-widest ${e.authorType === "admin" ? "text-gold-light" : "text-ink-soft"}`}>
                  {e.authorType === "admin" ? "7H STORE" : e.authorType === "system" ? "Sistema" : "Tú"} · {fmtDate(e.createdAt, true)}
                </p>
                {e.kind === "status" && e.toStatus && <p className="mt-1">Estado: <strong>{SUPPORT_STATUS[e.toStatus].label}</strong></p>}
                {e.kind === "created" && <p className="mt-1 font-semibold">Solicitud creada</p>}
                {e.body && <p className="mt-1 whitespace-pre-line leading-6">{e.body}</p>}
              </li>
            ))}
          </ol>
          {!st.final && <div className="mt-6"><SupportReplyForm code={r.code} /></div>}
        </Panel>
        <div className="space-y-6">
          <Panel title="Detalle">
            <dl className="space-y-2 text-sm">
              <div><dt className="text-xs text-ink-soft">Motivo</dt><dd>{r.reason}</dd></div>
              {r.items.length > 0 && <div><dt className="text-xs text-ink-soft">Productos</dt><dd>{r.items.map((i) => `${i.orderItem.name}${i.orderItem.size ? ` (${i.orderItem.size})` : ""} × ${i.quantity}`).join(", ")}</dd></div>}
              {!st.final && r.dueAt && <div><dt className="text-xs text-ink-soft">Respuesta estimada</dt><dd>Antes del {fmtDate(r.dueAt)}</dd></div>}
              {r.resolution && <div><dt className="text-xs text-ink-soft">Solución</dt><dd>{r.resolution}</dd></div>}
              {r.refundAmountCOP ? <div><dt className="text-xs text-ink-soft">Reembolso registrado</dt><dd>{formatCOP(r.refundAmountCOP)}{r.refundReference ? ` · ref. ${r.refundReference}` : ""}</dd></div> : null}
            </dl>
            <p className="mt-4 text-[11px] leading-5 text-ink-soft">{info.legal}</p>
          </Panel>
          <Panel title="Evidencias">
            {r.attachments.length === 0 ? <p className="text-sm text-ink-soft">Sin archivos.</p> : (
              <ul className="grid grid-cols-2 gap-3">
                {r.attachments.map((a) => (
                  <li key={a.id}>
                    <a href={`/api/cuenta/adjuntos/${a.id}`} target="_blank" rel="noreferrer" className="block overflow-hidden rounded-xl border border-ink/10 bg-ivory text-xs">
                      {a.mime.startsWith("image/") && a.mime !== "image/heic" ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={`/api/cuenta/adjuntos/${a.id}`} alt={a.fileName} className="aspect-square w-full object-cover" loading="lazy" />
                      ) : <span className="grid aspect-square place-items-center p-2 text-center">{a.fileName}</span>}
                    </a>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>
      </div>
    </>
  );
}
