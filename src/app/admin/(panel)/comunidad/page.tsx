import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireAdminPage } from "@/lib/admin/guard";
import { MODERATION_LABEL, moderationTone } from "@/lib/moderation";
import { CATEGORIES } from "@/lib/services/community";
import { Badge, PageHeader, fmtDate } from "@/components/admin/ui";
import { ModerationActions } from "@/components/admin/ModerationActions";
import { OfficialReply } from "@/components/admin/OfficialReply";

export const metadata = { title: "Comunidad" };

type View = "pendientes" | "reportes" | "recientes";
const VIEWS: { id: View; label: string }[] = [
  { id: "pendientes", label: "Por revisar" },
  { id: "reportes", label: "Reportados" },
  { id: "recientes", label: "Publicadas" },
];

/** Moderación de la Comunidad 7H: primeras publicaciones, contenido reportado y respuestas oficiales. */
export default async function AdminCommunity({ searchParams }: { searchParams: Promise<{ vista?: string }> }) {
  await requireAdminPage();
  const { vista } = await searchParams;
  const view = (VIEWS.find((v) => v.id === vista)?.id ?? "pendientes") as View;
  const [pendingCount, reportCount, posts, reportedComments] = await Promise.all([
    prisma.communityPost.count({ where: { status: "PENDIENTE" } }),
    prisma.communityReport.count({ where: { resolvedAt: null } }),
    prisma.communityPost.findMany({
      where: view === "pendientes" ? { status: "PENDIENTE" } : view === "reportes" ? { reports: { some: { resolvedAt: null } } } : { status: { in: ["APROBADA", "OCULTA"] } },
      orderBy: { createdAt: "desc" },
      take: 40,
      include: { customer: { select: { email: true } }, reports: { where: { resolvedAt: null }, select: { reason: true } }, _count: { select: { comments: true, reactions: true } } },
    }),
    view === "reportes"
      ? prisma.communityComment.findMany({ where: { reports: { some: { resolvedAt: null } } }, take: 40, include: { post: { select: { id: true, title: true } }, reports: { where: { resolvedAt: null }, select: { reason: true } } } })
      : Promise.resolve([]),
  ]);
  return (
    <>
      <PageHeader title="Comunidad" subtitle="La primera publicación de cada cliente se revisa antes de salir. Con 3 reportes, el contenido se oculta solo hasta que decidas." />
      <div className="no-scrollbar mb-5 flex gap-2 overflow-x-auto pb-1 text-xs">
        {VIEWS.map((v) => (
          <Link key={v.id} href={`/admin/comunidad?vista=${v.id}`} className={`shrink-0 rounded-full border px-3 py-1.5 font-semibold ${view === v.id ? "border-gold bg-gold/15" : "border-ink/15 bg-white"}`}>
            {v.label}{v.id === "pendientes" ? ` · ${pendingCount}` : v.id === "reportes" ? ` · ${reportCount}` : ""}
          </Link>
        ))}
      </div>
      {posts.length === 0 && reportedComments.length === 0 && <p className="rounded-2xl border border-ink/[.07] bg-white p-8 text-center text-sm text-ink-soft">Nada pendiente en esta vista.</p>}
      <ul className="space-y-4">
        {posts.map((p) => (
          <li key={p.id} className="rounded-2xl border border-ink/[.07] bg-white p-5 shadow-soft">
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <Badge tone={moderationTone(p.status)}>{MODERATION_LABEL[p.status]}</Badge>
              <Badge>{CATEGORIES[p.category]}</Badge>
              {p.pinned && <Badge tone="gold">Fijada</Badge>}
              <span className="text-ink-soft">{p.displayName} ({p.customer.email}) · {fmtDate(p.createdAt)} · ♥ {p._count.reactions} · {p._count.comments} comentarios</span>
              {p.status === "APROBADA" && <Link href={`/comunidad/${p.id}`} target="_blank" className="underline">ver</Link>}
            </div>
            <p className="mt-3 font-semibold">{p.title}</p>
            <p className="mt-1 whitespace-pre-line text-sm leading-6 text-ink-soft">{p.body}</p>
            {p.imagePath && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={`/media/comunidad/${p.id}`} alt="Foto de la publicación" className="mt-3 size-32 rounded-xl object-cover" />
            )}
            {p.reports.length > 0 && <p className="mt-2 rounded-xl bg-error/5 p-2 text-xs text-error">Reportes: {p.reports.map((r) => r.reason).join(" · ")}</p>}
            <div className="mt-4"><ModerationActions endpoint={`/api/admin/comunidad/publicaciones/${p.id}`} status={p.status} /></div>
            {p.status === "APROBADA" && <OfficialReply endpoint={`/api/admin/comunidad/publicaciones/${p.id}`} pinned={p.pinned} />}
          </li>
        ))}
        {reportedComments.map((c) => (
          <li key={c.id} className="rounded-2xl border border-error/20 bg-white p-5 shadow-soft">
            <p className="text-xs text-ink-soft">Comentario de {c.displayName} en «<Link href={`/comunidad/${c.post.id}`} target="_blank" className="underline">{c.post.title}</Link>» · <Badge tone={moderationTone(c.status)}>{MODERATION_LABEL[c.status]}</Badge></p>
            <p className="mt-2 whitespace-pre-line text-sm">{c.body}</p>
            <p className="mt-2 rounded-xl bg-error/5 p-2 text-xs text-error">Reportes: {c.reports.map((r) => r.reason).join(" · ")}</p>
            <div className="mt-3"><ModerationActions endpoint={`/api/admin/comunidad/comentarios/${c.id}`} status={c.status} /></div>
          </li>
        ))}
      </ul>
    </>
  );
}
