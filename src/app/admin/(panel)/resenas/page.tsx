import Link from "next/link";
import type { ModerationStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireAdminPage } from "@/lib/admin/guard";
import { MODERATION_LABEL, MODERATION_ORDER, moderationTone } from "@/lib/moderation";
import { Badge, PageHeader, fmtDate } from "@/components/admin/ui";
import { ModerationActions } from "@/components/admin/ModerationActions";

export const metadata = { title: "Reseñas" };

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

/** Moderación de reseñas: nada se publica hasta que alguien del equipo lo aprueba. */
export default async function AdminReviews({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requireAdminPage();
  const sp = await searchParams;
  const status = (MODERATION_ORDER as string[]).includes(one(sp.estado)) ? (one(sp.estado) as ModerationStatus) : "PENDIENTE";
  const [counts, rows] = await Promise.all([
    prisma.review.groupBy({ by: ["status"], _count: { _all: true } }),
    prisma.review.findMany({
      where: { status },
      orderBy: { createdAt: "desc" },
      take: 50,
      select: { id: true, rating: true, title: true, body: true, displayName: true, verified: true, status: true, moderationNote: true, helpfulCount: true, createdAt: true, customer: { select: { email: true } }, product: { select: { name: true, slug: true } }, photos: { select: { id: true }, orderBy: { position: "asc" } } },
    }),
  ]);
  const byStatus = Object.fromEntries(counts.map((c) => [c.status, c._count._all])) as Partial<Record<ModerationStatus, number>>;

  return (
    <>
      <PageHeader title="Reseñas" subtitle="Aprueba solo opiniones reales y respetuosas. La etiqueta Compra verificada la pone el sistema, no el cliente." />
      <div className="no-scrollbar mb-5 flex gap-2 overflow-x-auto pb-1 text-xs">
        {MODERATION_ORDER.map((s) => (
          <Link key={s} href={`/admin/resenas?estado=${s}`} className={`shrink-0 rounded-full border px-3 py-1.5 font-semibold ${status === s ? "border-gold bg-gold/15" : "border-ink/15 bg-white"}`}>
            {MODERATION_LABEL[s]} · {byStatus[s] ?? 0}
          </Link>
        ))}
      </div>
      {rows.length === 0 ? (
        <p className="rounded-2xl border border-ink/[.07] bg-white p-8 text-center text-sm text-ink-soft">No hay reseñas {MODERATION_LABEL[status].toLowerCase()}s.</p>
      ) : (
        <ul className="space-y-4">
          {rows.map((r) => (
            <li key={r.id} className="rounded-2xl border border-ink/[.07] bg-white p-5 shadow-soft">
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <span className="text-base text-gold" aria-label={`${r.rating} de 5`}>{"★".repeat(r.rating)}<span className="text-ink/20">{"★".repeat(5 - r.rating)}</span></span>
                <Badge tone={moderationTone(r.status)}>{MODERATION_LABEL[r.status]}</Badge>
                {r.verified && <Badge tone="gold">Compra verificada</Badge>}
                <Link href={`/producto/${r.product.slug}#opiniones`} target="_blank" className="font-semibold underline-offset-2 hover:underline">{r.product.name}</Link>
                <span className="text-ink-soft">· {r.displayName} ({r.customer.email}) · {fmtDate(r.createdAt)} · {r.helpfulCount} útil</span>
              </div>
              {r.title && <p className="mt-3 font-semibold">{r.title}</p>}
              <p className="mt-1 whitespace-pre-line text-sm leading-6 text-ink-soft">{r.body}</p>
              {r.photos.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {r.photos.map((p) => (
                    <a key={p.id} href={`/media/resenas/${p.id}`} target="_blank" rel="noreferrer" className="block size-24 overflow-hidden rounded-xl ring-1 ring-ink/10">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={`/media/resenas/${p.id}`} alt="Foto de la reseña" className="size-full object-cover" />
                    </a>
                  ))}
                </div>
              )}
              {r.moderationNote && <p className="mt-2 text-xs text-ink-soft">Nota interna: {r.moderationNote}</p>}
              <div className="mt-4"><ModerationActions endpoint={`/api/admin/resenas/${r.id}`} status={r.status} /></div>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
