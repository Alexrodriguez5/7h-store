import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PageBody, PageHero } from "@/components/aura/PageHero";
import { CommentForm, ReactButton, ReplyToggle, ReportButton } from "@/components/community/CommunityClient";
import { getCurrentCustomer } from "@/lib/customer/auth";
import { CATEGORIES, CATEGORY_SLUG } from "@/lib/services/community";
import { prisma } from "@/lib/prisma";

const fmt = (d: Date) => new Intl.DateTimeFormat("es-CO", { dateStyle: "medium", timeZone: "America/Bogota" }).format(d);

async function load(id: string) {
  return prisma.communityPost.findFirst({
    where: { id: id.slice(0, 40), status: "APROBADA" },
    include: {
      _count: { select: { reactions: true } },
      comments: { where: { status: "APROBADA", parentId: null }, orderBy: { createdAt: "asc" }, include: { replies: { where: { status: "APROBADA" }, orderBy: { createdAt: "asc" } } } },
    },
  });
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const p = await load((await params).id);
  return p ? { title: `${p.title} · Comunidad 7H`, description: p.body.slice(0, 150) } : { title: "Comunidad 7H" };
}

export default async function PostPage({ params }: { params: Promise<{ id: string }> }) {
  const [{ id }, customer] = await Promise.all([params, getCurrentCustomer().catch(() => null)]);
  const p = await load(id);
  if (!p) notFound();
  const loggedIn = !!customer;
  return (
    <main id="contenido">
      <PageHero quiet eyebrow={CATEGORIES[p.category]} title={p.title} crumbs={[{ href: "/comunidad", label: "Comunidad" }, { href: `/comunidad?tema=${CATEGORY_SLUG[p.category]}`, label: CATEGORIES[p.category] }]} />
      <PageBody className="max-w-3xl">
        <article className="surface rounded-[28px] p-6 sm:p-8">
          <p className="text-xs text-ink-soft"><span className="font-semibold text-ink">{p.displayName}</span> · {fmt(p.createdAt)}</p>
          <p className="mt-4 whitespace-pre-line text-[15px] leading-7">{p.body}</p>
          {p.imagePath && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={`/media/comunidad/${p.id}`} alt={`Foto de ${p.displayName}`} loading="lazy" className="mt-5 max-h-[520px] w-full rounded-2xl object-cover" />
          )}
          <div className="mt-5 flex items-center gap-4">
            <ReactButton postId={p.id} count={p._count.reactions} loggedIn={loggedIn} />
            <ReportButton postId={p.id} loggedIn={loggedIn} />
          </div>
        </article>

        <section aria-labelledby="comentarios" className="mt-8">
          <h2 id="comentarios" className="type-h3">{p.comments.length} {p.comments.length === 1 ? "comentario" : "comentarios"}</h2>
          <ul className="mt-4 space-y-3">
            {p.comments.map((c) => (
              <li key={c.id} className={`rounded-[20px] p-4 ${c.adminId ? "bg-ink text-ivory" : "surface"}`}>
                <p className={`text-[11px] ${c.adminId ? "text-gold-light" : "text-ink-soft"}`}><span className="font-semibold">{c.adminId ? "7H STORE · respuesta oficial" : c.displayName}</span> · {fmt(c.createdAt)}</p>
                <p className="mt-1 whitespace-pre-line text-sm leading-6">{c.body}</p>
                {!c.adminId && <div className="mt-2 flex items-center gap-4">{loggedIn && <ReplyToggle postId={p.id} parentId={c.id} />}<ReportButton commentId={c.id} loggedIn={loggedIn} /></div>}
                {c.replies.length > 0 && (
                  <ul className="mt-3 space-y-2 border-l-2 border-gold/40 pl-4">
                    {c.replies.map((r) => (
                      <li key={r.id}>
                        <p className="text-[11px] text-ink-soft"><span className="font-semibold">{r.adminId ? "7H STORE" : r.displayName}</span> · {fmt(r.createdAt)}</p>
                        <p className="whitespace-pre-line text-sm leading-6">{r.body}</p>
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            ))}
          </ul>
          <div className="mt-5">
            {loggedIn ? (
              customer?.emailVerifiedAt ? <CommentForm postId={p.id} /> : <p className="text-sm text-ink-soft">Confirma tu correo para comentar.</p>
            ) : (
              <Link href={`/cuenta?next=/comunidad/${p.id}`} className="inline-flex rounded-full bg-ink px-6 py-3 text-sm font-semibold text-ivory transition-colors hover:bg-gold hover:text-ink">Inicia sesión para comentar</Link>
            )}
          </div>
        </section>
      </PageBody>
    </main>
  );
}
