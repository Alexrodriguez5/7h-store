import Link from "next/link";
import type { ProductRequestStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireAdminPage } from "@/lib/admin/guard";
import { formatCOP } from "@/lib/format";
import { REQUEST_STATUS, REQUEST_STATUS_ORDER } from "@/lib/services/product-requests";
import { Badge, PageHeader, btnGhost, fmtDate } from "@/components/admin/ui";
import { ReplyStatusForm } from "@/components/admin/ReplyStatusForm";

export const metadata = { title: "Tú lo buscas" };

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";
const OPEN: ProductRequestStatus[] = ["NUEVA", "EN_REVISION", "COTIZANDO"];

/** Solicitudes de productos que los clientes quieren que traigamos. */
export default async function AdminProductRequests({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requireAdminPage();
  const sp = await searchParams;
  const status = (REQUEST_STATUS_ORDER as string[]).includes(one(sp.estado)) ? (one(sp.estado) as ProductRequestStatus) : undefined;
  const [counts, rows] = await Promise.all([
    prisma.productRequest.groupBy({ by: ["status"], _count: { _all: true } }),
    prisma.productRequest.findMany({ where: status ? { status } : { status: { in: OPEN } }, orderBy: { createdAt: "desc" }, take: 60 }),
  ]);
  const byStatus = Object.fromEntries(counts.map((c) => [c.status, c._count._all])) as Partial<Record<ProductRequestStatus, number>>;
  const statuses = REQUEST_STATUS_ORDER.map((s) => ({ value: s, label: REQUEST_STATUS[s].label }));

  return (
    <>
      <PageHeader title="Tú lo buscas" subtitle="Productos que los clientes quieren que traigamos. Responde con honestidad: no prometas lo que no se pueda conseguir." />
      <div className="no-scrollbar mb-5 flex gap-2 overflow-x-auto pb-1 text-xs">
        <Link href="/admin/tu-lo-buscas" className={`shrink-0 rounded-full border px-3 py-1.5 font-semibold ${!status ? "border-gold bg-gold/15" : "border-ink/15 bg-white"}`}>Abiertas · {OPEN.reduce((n, s) => n + (byStatus[s] ?? 0), 0)}</Link>
        {REQUEST_STATUS_ORDER.map((s) => (
          <Link key={s} href={`/admin/tu-lo-buscas?estado=${s}`} className={`shrink-0 rounded-full border px-3 py-1.5 font-semibold ${status === s ? "border-gold bg-gold/15" : "border-ink/15 bg-white"}`}>{REQUEST_STATUS[s].label} · {byStatus[s] ?? 0}</Link>
        ))}
      </div>
      {rows.length === 0 ? (
        <p className="rounded-2xl border border-ink/[.07] bg-white p-8 text-center text-sm text-ink-soft">No hay solicitudes en esta vista.</p>
      ) : (
        <ul className="space-y-4">
          {rows.map((r) => (
            <li key={r.id} className="rounded-2xl border border-ink/[.07] bg-white p-5 shadow-soft">
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <span className="font-mono font-semibold">{r.code}</span>
                <Badge tone={OPEN.includes(r.status) ? "warning" : r.status === "DISPONIBLE" ? "success" : "neutral"}>{REQUEST_STATUS[r.status].label}</Badge>
                <span className="text-ink-soft">{fmtDate(r.createdAt)} · {r.name} &lt;{r.email}&gt;{r.customerId ? " · con cuenta" : ""}</span>
              </div>
              <div className="mt-3 grid gap-4 sm:grid-cols-[1fr_auto]">
                <div>
                  <p className="text-base font-semibold">{r.productName}</p>
                  <p className="text-sm text-ink-soft">{[r.brand, r.model].filter(Boolean).join(" · ") || "Sin marca ni modelo"}{r.budgetCOP ? ` · Presupuesto ${formatCOP(r.budgetCOP)}` : ""}</p>
                  {r.url && <p className="mt-1 break-all text-xs"><a href={r.url} target="_blank" rel="noopener noreferrer nofollow" className="underline">{r.url}</a> <span className="text-ink-soft">(enlace del cliente: ábrelo con precaución)</span></p>}
                  {r.comments && <p className="mt-2 whitespace-pre-line text-sm leading-6">{r.comments}</p>}
                  {r.adminReply && <p className="mt-2 rounded-xl bg-ivory/70 p-3 text-xs">Última respuesta ({r.repliedAt ? fmtDate(r.repliedAt) : ""}): {r.adminReply}</p>}
                </div>
                {r.imagePath && (
                  <a href={`/media/solicitudes/${r.id}`} target="_blank" rel="noreferrer" className="block size-28 overflow-hidden rounded-xl ring-1 ring-ink/10">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={`/media/solicitudes/${r.id}`} alt="Foto de referencia" className="size-full object-cover" />
                  </a>
                )}
              </div>
              <ReplyStatusForm endpoint={`/api/admin/tu-lo-buscas/${r.id}`} status={r.status} statuses={statuses} />
              <div className="mt-3">
                {r.productId ? (
                  <Link href={`/admin/productos/${r.productId}/editar`} className={btnGhost}>Ver producto creado</Link>
                ) : (
                  <Link href={`/admin/productos/nuevo?solicitud=${r.id}`} className={btnGhost}>Convertir en producto del catálogo</Link>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
