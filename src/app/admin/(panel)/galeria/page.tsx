import Link from "next/link";
import type { ModerationStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireAdminPage } from "@/lib/admin/guard";
import { MODERATION_LABEL, MODERATION_ORDER, moderationTone } from "@/lib/moderation";
import { Badge, PageHeader, fmtDate } from "@/components/admin/ui";
import { ModerationActions } from "@/components/admin/ModerationActions";
import { StoreMediaForm } from "@/components/admin/StoreMediaForm";
import { FeatureToggle } from "@/components/admin/FeatureToggle";

export const metadata = { title: "Galería" };

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

/** "Así se vive 7H": contenido de la tienda y fotos de clientes (solo con su autorización). */
export default async function AdminGallery({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requireAdminPage();
  const sp = await searchParams;
  const status = (MODERATION_ORDER as string[]).includes(one(sp.estado)) ? (one(sp.estado) as ModerationStatus) : "PENDIENTE";
  const [counts, rows] = await Promise.all([
    prisma.mediaItem.groupBy({ by: ["status"], where: { withdrawnAt: null }, _count: { _all: true } }),
    prisma.mediaItem.findMany({ where: { status, withdrawnAt: null }, orderBy: { createdAt: "desc" }, take: 60, include: { customer: { select: { email: true } }, product: { select: { name: true } } } }),
  ]);
  const byStatus = Object.fromEntries(counts.map((c) => [c.status, c._count._all])) as Partial<Record<ModerationStatus, number>>;
  return (
    <>
      <PageHeader title="Galería" subtitle="Así se vive 7H. Las fotos de clientes llegan con su autorización y no se publican hasta que las apruebes." />
      <StoreMediaForm />
      <div className="no-scrollbar mb-5 flex gap-2 overflow-x-auto pb-1 text-xs">
        {MODERATION_ORDER.map((s) => (
          <Link key={s} href={`/admin/galeria?estado=${s}`} className={`shrink-0 rounded-full border px-3 py-1.5 font-semibold ${status === s ? "border-gold bg-gold/15" : "border-ink/15 bg-white"}`}>{MODERATION_LABEL[s]} · {byStatus[s] ?? 0}</Link>
        ))}
      </div>
      {rows.length === 0 ? (
        <p className="rounded-2xl border border-ink/[.07] bg-white p-8 text-center text-sm text-ink-soft">Nada en esta vista.</p>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {rows.map((m) => (
            <li key={m.id} className="overflow-hidden rounded-2xl border border-ink/[.07] bg-white shadow-soft">
              {m.kind === "VIDEO" ? (
                <a href={m.path} target="_blank" rel="noopener noreferrer" className="grid aspect-video place-items-center bg-ink text-sm text-gold-light">▶ Ver video</a>
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={m.source === "customer" ? `/media/galeria/${m.id}` : m.path} alt={m.caption ?? "Contenido de la galería"} className="aspect-square w-full object-cover" />
              )}
              <div className="space-y-2 p-4 text-xs">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone={moderationTone(m.status)}>{MODERATION_LABEL[m.status]}</Badge>
                  <Badge>{m.source === "customer" ? "Cliente" : "Tienda"}</Badge>
                  {m.featured && <Badge tone="gold">En portada</Badge>}
                </div>
                {m.caption && <p className="text-sm">{m.caption}</p>}
                <p className="text-ink-soft">{m.source === "customer" ? `${m.displayName} (${m.customer?.email ?? "sin cuenta"}) · autorizó ${m.consentAt ? fmtDate(m.consentAt) : "—"}` : "7H STORE"}{m.product ? ` · ${m.product.name}` : ""}</p>
                <ModerationActions endpoint={`/api/admin/galeria/${m.id}`} status={m.status} />
                {m.status === "APROBADA" && <FeatureToggle endpoint={`/api/admin/galeria/${m.id}`} featured={m.featured} />}
              </div>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
