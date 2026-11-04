import type { Metadata } from "next";
import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { PageBody, PageHero } from "@/components/aura/PageHero";
import { CATEGORIES, CATEGORY_SLUG, categoryFromSlug } from "@/lib/services/community";
import { prisma } from "@/lib/prisma";

export const metadata: Metadata = {
  title: "Comunidad 7H",
  description: "Recomendaciones, preguntas e ideas de clientes de 7H STORE.",
  alternates: { canonical: "/comunidad" },
};

const fmt = (d: Date) => new Intl.DateTimeFormat("es-CO", { day: "numeric", month: "short", timeZone: "America/Bogota" }).format(d);

export default async function CommunityPage({ searchParams }: { searchParams: Promise<{ tema?: string; q?: string }> }) {
  const sp = await searchParams;
  const category = categoryFromSlug(sp.tema);
  const q = sp.q?.trim().slice(0, 80) ?? "";
  const where: Prisma.CommunityPostWhereInput = {
    status: "APROBADA",
    ...(category ? { category } : {}),
    ...(q ? { OR: [{ title: { contains: q, mode: "insensitive" } }, { body: { contains: q, mode: "insensitive" } }] } : {}),
  };
  const posts = await prisma.communityPost.findMany({
    where, orderBy: [{ pinned: "desc" }, { createdAt: "desc" }], take: 30,
    select: { id: true, title: true, body: true, category: true, displayName: true, createdAt: true, pinned: true, imagePath: true, _count: { select: { comments: { where: { status: "APROBADA" } }, reactions: true } } },
  });
  return (
    <main id="contenido">
      <PageHero eyebrow="Comunidad 7H" title="Recomienda, pregunta," accent="propón." lead="Un espacio sencillo para conversar con otros clientes y con el equipo de 7H STORE.">
        <Link href="/comunidad/nueva" className="inline-flex rounded-full bg-gold px-6 py-3 text-sm font-semibold text-ink transition-colors hover:bg-gold-light">Crear publicación</Link>
      </PageHero>
      <PageBody className="max-w-5xl">
        <div className="surface flex flex-col gap-3 rounded-[24px] p-3 sm:flex-row sm:items-center">
          <nav aria-label="Temas" className="no-scrollbar flex flex-1 gap-1.5 overflow-x-auto">
            <Link href="/comunidad" className={`shrink-0 rounded-full px-3.5 py-2 text-xs ${!category ? "bg-ink font-semibold text-gold-light" : "hover:bg-ink/[.05]"}`}>Todo</Link>
            {Object.entries(CATEGORIES).map(([k, label]) => (
              <Link key={k} href={`/comunidad?tema=${CATEGORY_SLUG[k as keyof typeof CATEGORY_SLUG]}`} className={`shrink-0 rounded-full px-3.5 py-2 text-xs ${category === k ? "bg-ink font-semibold text-gold-light" : "hover:bg-ink/[.05]"}`}>{label}</Link>
            ))}
          </nav>
          <form action="/comunidad" className="flex gap-2">
            {sp.tema && <input type="hidden" name="tema" value={sp.tema} />}
            <label className="sr-only" htmlFor="cq">Buscar en la comunidad</label>
            <input id="cq" name="q" defaultValue={q} placeholder="Buscar" className="w-full rounded-full border border-ink/15 bg-white px-4 py-2 text-sm outline-none focus:border-gold sm:w-48" />
          </form>
        </div>

        {posts.length === 0 ? (
          <div className="surface mt-6 rounded-[28px] px-6 py-14 text-center">
            <p className="type-h3">{q || category ? "No hay publicaciones con ese filtro." : "La comunidad está empezando."}</p>
            <p className="mx-auto mt-2 max-w-md text-sm text-ink-soft">Haz la primera pregunta o comparte una recomendación.</p>
          </div>
        ) : (
          <ul className="mt-6 space-y-3">
            {posts.map((p) => (
              <li key={p.id}>
                <Link href={`/comunidad/${p.id}`} className="surface surface-hover block rounded-[24px] p-5 sm:p-6">
                  <div className="flex flex-wrap items-center gap-2 text-[11px] text-ink-soft">
                    {p.pinned && <span className="rounded-full bg-gold px-2 py-0.5 font-semibold text-ink">Fijada</span>}
                    <span className="font-semibold uppercase tracking-[.16em] text-gold">{CATEGORIES[p.category]}</span>
                    <span>· {p.displayName} · {fmt(p.createdAt)}</span>
                  </div>
                  <p className="type-h3 mt-2">{p.title}</p>
                  <p className="mt-1 line-clamp-2 text-sm leading-6 text-ink-soft">{p.body}</p>
                  <p className="mt-3 text-xs text-ink-soft">♥ {p._count.reactions} · {p._count.comments} {p._count.comments === 1 ? "comentario" : "comentarios"}{p.imagePath ? " · con foto" : ""}</p>
                </Link>
              </li>
            ))}
          </ul>
        )}
        <p className="mt-8 text-center text-xs leading-5 text-ink-soft">Normas: respeto, nada de spam, enlaces ni datos personales. Puedes reportar cualquier contenido inapropiado.</p>
      </PageBody>
    </main>
  );
}
