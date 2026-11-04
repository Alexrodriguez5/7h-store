import Link from "next/link";
import type { InquiryStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireAdminPage } from "@/lib/admin/guard";
import { INQUIRY_STATUS, TOPICS } from "@/lib/services/inquiries";
import { Badge, PageHeader, fmtDate } from "@/components/admin/ui";
import { ReplyStatusForm } from "@/components/admin/ReplyStatusForm";

export const metadata = { title: "Consultas" };

const ORDER: InquiryStatus[] = ["ABIERTA", "RESPONDIDA", "CERRADA"];
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

/** "Habla con 7H STORE": consultas de clientes. Las esperando respuesta aparecen primero. */
export default async function AdminInquiries({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requireAdminPage();
  const sp = await searchParams;
  const status = (ORDER as string[]).includes(one(sp.estado)) ? (one(sp.estado) as InquiryStatus) : "ABIERTA";
  const [counts, rows] = await Promise.all([
    prisma.inquiry.groupBy({ by: ["status"], _count: { _all: true } }),
    prisma.inquiry.findMany({ where: { status }, orderBy: { updatedAt: status === "ABIERTA" ? "asc" : "desc" }, take: 40, include: { messages: { orderBy: { createdAt: "asc" } } } }),
  ]);
  const byStatus = Object.fromEntries(counts.map((c) => [c.status, c._count._all])) as Partial<Record<InquiryStatus, number>>;
  const statuses = ORDER.map((s) => ({ value: s, label: INQUIRY_STATUS[s] }));
  return (
    <>
      <PageHeader title="Consultas" subtitle="Habla con 7H STORE. Tu respuesta llega al cliente por correo con el enlace a la conversación." />
      <div className="no-scrollbar mb-5 flex gap-2 overflow-x-auto pb-1 text-xs">
        {ORDER.map((s) => (
          <Link key={s} href={`/admin/consultas?estado=${s}`} className={`shrink-0 rounded-full border px-3 py-1.5 font-semibold ${status === s ? "border-gold bg-gold/15" : "border-ink/15 bg-white"}`}>{INQUIRY_STATUS[s]} · {byStatus[s] ?? 0}</Link>
        ))}
      </div>
      {rows.length === 0 ? (
        <p className="rounded-2xl border border-ink/[.07] bg-white p-8 text-center text-sm text-ink-soft">No hay consultas en esta vista.</p>
      ) : (
        <ul className="space-y-4">
          {rows.map((q) => (
            <li key={q.id} className="rounded-2xl border border-ink/[.07] bg-white p-5 shadow-soft">
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <span className="font-mono font-semibold">{q.code}</span>
                <Badge tone={q.status === "ABIERTA" ? "warning" : q.status === "RESPONDIDA" ? "success" : "neutral"}>{INQUIRY_STATUS[q.status]}</Badge>
                <Badge>{TOPICS[q.topic]}</Badge>
                <span className="text-ink-soft">{q.name} &lt;{q.email}&gt; · {fmtDate(q.createdAt)}</span>
                {q.productSlug && <Link href={`/producto/${q.productSlug}`} target="_blank" className="underline">producto</Link>}
              </div>
              <p className="mt-3 font-semibold">{q.subject}</p>
              <ol className="mt-3 space-y-2">
                {q.messages.map((m) => (
                  <li key={m.id} className={`rounded-xl p-3 text-sm ${m.author === "admin" ? "bg-ink text-ivory" : "bg-ivory/70"}`}>
                    <p className={`text-[11px] font-semibold ${m.author === "admin" ? "text-gold-light" : "text-ink-soft"}`}>{m.author === "admin" ? "7H STORE" : q.name} · {fmtDate(m.createdAt)}</p>
                    <p className="mt-1 whitespace-pre-line">{m.body}</p>
                  </li>
                ))}
              </ol>
              <ReplyStatusForm endpoint={`/api/admin/consultas/${q.id}`} status={q.status} statuses={statuses} />
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
