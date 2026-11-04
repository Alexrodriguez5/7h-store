"use client";

import Link from "next/link";
import { useMemo, useState, type FormEvent } from "react";
import type { PublicReview } from "@/lib/services/reviews";
import { PhotoPicker, postMultipart } from "@/components/ugc/PhotoPicker";
import { StarInput, Stars } from "@/components/ugc/Stars";

type Sort = "recientes" | "mejor" | "peor" | "utiles" | "fotos";
const SORTS: { id: Sort; label: string }[] = [
  { id: "recientes", label: "Más recientes" },
  { id: "utiles", label: "Más útiles" },
  { id: "mejor", label: "Mejor calificación" },
  { id: "peor", label: "Peor calificación" },
  { id: "fotos", label: "Con fotos" },
];

const fmt = (iso: string) => new Intl.DateTimeFormat("es-CO", { day: "numeric", month: "long", year: "numeric", timeZone: "America/Bogota" }).format(new Date(iso));

export interface ReviewsProps {
  productId: string;
  productSlug: string;
  reviews: PublicReview[];
  average: number;
  histogram: { stars: number; count: number }[];
  /** Estado del visitante (calculado en el servidor). */
  viewer: { loggedIn: boolean; verifiedEmail: boolean; verifiedBuyer: boolean; ownStatus: string | null };
}

/**
 * Opiniones del producto: solo reseñas APROBADAS por el equipo. Nada inventado:
 * si no hay reseñas, se invita a los primeros compradores a contar su experiencia.
 */
export function ReviewsSection({ productId, productSlug, reviews, average, histogram, viewer }: ReviewsProps) {
  const [sort, setSort] = useState<Sort>("recientes");
  const [open, setOpen] = useState(false);
  const [lightbox, setLightbox] = useState<{ photos: string[]; i: number } | null>(null);
  const count = reviews.length;

  const list = useMemo(() => {
    const r = [...reviews];
    if (sort === "fotos") return r.filter((x) => x.photos.length > 0);
    if (sort === "mejor") return r.sort((a, b) => b.rating - a.rating);
    if (sort === "peor") return r.sort((a, b) => a.rating - b.rating);
    if (sort === "utiles") return r.sort((a, b) => b.helpfulCount - a.helpfulCount);
    return r;
  }, [reviews, sort]);

  const login = `/cuenta?next=${encodeURIComponent(`/producto/${productSlug}#opiniones`)}`;

  return (
    <section id="opiniones" aria-labelledby="opiniones-titulo" className="scroll-mt-28">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[.3em] text-gold">Opiniones de clientes</p>
          <h2 id="opiniones-titulo" className="mt-2 type-h2">Lo que dicen <span className="text-gold">quienes lo tienen.</span></h2>
        </div>
        {!open && (
          viewer.loggedIn ? (
            <button type="button" onClick={() => setOpen(true)} className="btn-shine rounded-full bg-ink px-6 py-3 text-sm font-semibold text-ivory transition-colors hover:bg-gold hover:text-ink">
              {viewer.ownStatus ? "Editar mi reseña" : "Escribir una reseña"}
            </button>
          ) : (
            <Link href={login} className="rounded-full bg-ink px-6 py-3 text-sm font-semibold text-ivory transition-colors hover:bg-gold hover:text-ink">Inicia sesión para opinar</Link>
          )
        )}
      </div>

      {viewer.ownStatus === "PENDIENTE" && !open && (
        <p role="status" className="mt-5 rounded-2xl border border-gold/40 bg-gold/10 p-4 text-sm">Recibimos tu reseña. La publicamos cuando el equipo la revise.</p>
      )}

      {open && <ReviewForm productId={productId} viewer={viewer} onClose={() => setOpen(false)} />}

      {count === 0 ? (
        !open && (
          <div className="surface mt-8 rounded-[28px] px-6 py-12 text-center">
            <Stars value={0} size={26} className="mx-auto" />
            <p className="mt-4 font-display text-3xl">Aún no hay opiniones.</p>
            <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-ink-soft">¿Ya lo compraste? Sé de los primeros en contar tu experiencia y ayuda a otros compradores a decidir.</p>
          </div>
        )
      ) : (
        <div className="mt-8 grid gap-8 lg:grid-cols-[300px_1fr]">
          <aside className="surface h-fit rounded-[28px] p-6 lg:sticky lg:top-28">
            <p className="font-display text-6xl leading-none">{average.toFixed(1)}</p>
            <Stars value={average} size={20} className="mt-2" />
            <p className="mt-1 text-xs text-ink-soft">{count} {count === 1 ? "opinión" : "opiniones"}</p>
            <ul className="mt-5 space-y-1.5">
              {histogram.map((h) => (
                <li key={h.stars} className="flex items-center gap-2 text-xs">
                  <span className="w-3 tabular-nums">{h.stars}</span>
                  <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-ink/10"><span className="block h-full rounded-full bg-gold" style={{ width: `${count ? (h.count / count) * 100 : 0}%` }} /></span>
                  <span className="w-6 text-right tabular-nums text-ink-soft">{h.count}</span>
                </li>
              ))}
            </ul>
          </aside>

          <div>
            <div className="no-scrollbar flex gap-2 overflow-x-auto pb-1" role="radiogroup" aria-label="Ordenar opiniones">
              {SORTS.map((s) => (
                <button key={s.id} type="button" role="radio" aria-checked={sort === s.id} onClick={() => setSort(s.id)} className={`shrink-0 rounded-full border px-3.5 py-2 text-xs transition-colors ${sort === s.id ? "border-ink bg-ink font-semibold text-gold-light" : "border-ink/15 bg-white/60 hover:border-gold"}`}>{s.label}</button>
              ))}
            </div>
            <ul className="mt-5 space-y-4">
              {list.map((r) => <ReviewCard key={r.id} review={r} loggedIn={viewer.loggedIn} login={login} onPhoto={(i) => setLightbox({ photos: r.photos.map((p) => `/media/resenas/${p.id}`), i })} />)}
              {list.length === 0 && <li className="text-sm text-ink-soft">Ninguna opinión tiene fotos todavía.</li>}
            </ul>
          </div>
        </div>
      )}

      {lightbox && <Lightbox {...lightbox} onClose={() => setLightbox(null)} onMove={(i) => setLightbox({ ...lightbox, i })} />}
    </section>
  );
}

function ReviewCard({ review: r, loggedIn, login, onPhoto }: { review: PublicReview; loggedIn: boolean; login: string; onPhoto: (i: number) => void }) {
  const [helpful, setHelpful] = useState(r.helpfulCount);
  const [voted, setVoted] = useState(false);
  const [msg, setMsg] = useState<string>();
  const vote = async () => {
    if (!loggedIn) return window.location.assign(login);
    const res = await fetch(`/api/resenas/${r.id}/util`, { method: "POST" }).catch(() => null);
    const data = (await res?.json().catch(() => ({}))) as { helpfulCount?: number; voted?: boolean; error?: string } | undefined;
    if (res?.ok && data) { setHelpful(data.helpfulCount ?? helpful); setVoted(!!data.voted); setMsg(undefined); }
    else setMsg(data?.error ?? "No se pudo registrar tu voto.");
  };
  return (
    <li className="surface panel-in rounded-[24px] p-5 sm:p-6">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <Stars value={r.rating} />
        {r.title && <p className="font-semibold">{r.title}</p>}
      </div>
      <p className="mt-1 flex flex-wrap items-center gap-2 text-xs text-ink-soft">
        <span className="font-medium text-ink">{r.displayName}</span>
        <span aria-hidden="true">·</span>
        <time dateTime={r.createdAt}>{fmt(r.createdAt)}</time>
        {r.verified && (
          <span className="inline-flex items-center gap-1 rounded-full bg-ink px-2 py-0.5 text-[10px] font-semibold text-gold-light" title="7H STORE confirmó que compró este producto">
            <svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" strokeWidth="3" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>
            Compra verificada
          </span>
        )}
      </p>
      <p className="mt-3 whitespace-pre-line text-sm leading-7 text-ink-soft">{r.body}</p>
      {r.photos.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-2">
          {r.photos.map((p, i) => (
            <button key={p.id} type="button" onClick={() => onPhoto(i)} className="group relative size-20 overflow-hidden rounded-2xl ring-1 ring-ink/10" aria-label={`Ver foto ${i + 1} de ${r.displayName}`}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={`/media/resenas/${p.id}`} alt="" loading="lazy" className="size-full object-cover transition-transform duration-500 group-hover:scale-110" />
            </button>
          ))}
        </div>
      )}
      <div className="mt-4 flex items-center gap-3 text-xs">
        <button type="button" onClick={vote} aria-pressed={voted} className={`rounded-full border px-3 py-1.5 transition-colors ${voted ? "border-gold bg-gold/15 font-semibold" : "border-ink/15 hover:border-gold"}`}>
          👍 Me fue útil{helpful > 0 ? ` · ${helpful}` : ""}
        </button>
        {msg && <span className="text-error">{msg}</span>}
      </div>
    </li>
  );
}

function ReviewForm({ productId, viewer, onClose }: { productId: string; viewer: ReviewsProps["viewer"]; onClose: () => void }) {
  const [rating, setRating] = useState(0);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [alias, setAlias] = useState("");
  const [website, setWebsite] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string>();
  const [done, setDone] = useState(false);

  if (!viewer.verifiedEmail) {
    return <p className="surface mt-6 rounded-2xl p-5 text-sm">Primero confirma tu correo con el enlace que te enviamos. Así protegemos las opiniones de cuentas falsas.</p>;
  }

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!rating) return setError("Elige de 1 a 5 estrellas.");
    setSending(true);
    setError(undefined);
    const r = await postMultipart(`/api/productos/${productId}/resenas`, { rating, title, body, alias, website }, files);
    setSending(false);
    if (!r.ok) return setError(r.error);
    setDone(true);
  };

  if (done) {
    return (
      <div role="status" className="surface panel-in mt-6 flex items-center gap-4 rounded-[24px] p-6">
        <span className="grid size-12 shrink-0 place-items-center rounded-full bg-ink text-gold-light">
          <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2.4" aria-hidden="true"><path className="draw-check" d="M5 12.5l4.5 4.5L19 7.5" /></svg>
        </span>
        <div>
          <p className="font-semibold">¡Gracias por tu opinión!</p>
          <p className="text-sm text-ink-soft">La publicamos cuando el equipo la revise. {viewer.verifiedBuyer ? "Aparecerá con la etiqueta Compra verificada." : ""}</p>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="surface panel-in mt-6 space-y-5 rounded-[28px] p-6 sm:p-8" noValidate>
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="font-display text-3xl">Tu opinión</p>
          <p className="mt-1 text-xs text-ink-soft">
            {viewer.verifiedBuyer ? "Compraste este producto: tu reseña llevará la etiqueta Compra verificada." : "Si compraste este producto con este correo, lo detectamos solos."}
          </p>
        </div>
        <button type="button" onClick={onClose} className="text-xs text-ink-soft underline-offset-4 hover:underline">Cancelar</button>
      </div>
      <StarInput value={rating} onChange={setRating} />
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block text-xs font-semibold">Título (opcional)<input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={80} className="mt-1 w-full rounded-xl border border-ink/15 bg-white px-3 py-2.5 text-sm font-normal outline-none focus:border-gold focus:shadow-[0_0_0_4px_rgb(201_164_76_/_.15)]" /></label>
        <label className="block text-xs font-semibold">Nombre público (opcional)<input value={alias} onChange={(e) => setAlias(e.target.value)} maxLength={40} placeholder="Ej.: Laura M." className="mt-1 w-full rounded-xl border border-ink/15 bg-white px-3 py-2.5 text-sm font-normal outline-none focus:border-gold focus:shadow-[0_0_0_4px_rgb(201_164_76_/_.15)]" /></label>
      </div>
      <label className="block text-xs font-semibold">
        Tu experiencia *
        <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={5} maxLength={2000} required placeholder="¿Cómo te quedó? ¿Qué tal la calidad, la talla y la entrega?" className="mt-1 w-full rounded-xl border border-ink/15 bg-white px-3 py-2.5 text-sm font-normal outline-none focus:border-gold focus:shadow-[0_0_0_4px_rgb(201_164_76_/_.15)]" />
        <span className="mt-1 block text-right font-normal text-ink-soft">{body.length}/2000</span>
      </label>
      {/* Campo trampa contra robots (oculto para personas) */}
      <input type="text" tabIndex={-1} autoComplete="off" aria-hidden="true" value={website} onChange={(e) => setWebsite(e.target.value)} className="absolute -left-[9999px] h-0 w-0 opacity-0" name="website" />
      <PhotoPicker files={files} onChange={setFiles} label="Fotos reales" />
      <p className="text-[11px] leading-5 text-ink-soft">Al enviar autorizas a 7H STORE a publicar tu reseña y tus fotos en esta página con tu nombre público. No incluyas datos personales. Puedes pedir que la retiremos cuando quieras.</p>
      {error && <p role="alert" className="text-sm text-error">{error}</p>}
      <button type="submit" disabled={sending} className="btn-shine w-full rounded-full bg-ink py-3.5 text-sm font-semibold text-ivory transition-colors hover:bg-gold hover:text-ink disabled:opacity-60 sm:w-auto sm:px-10">
        {sending ? "Enviando…" : "Enviar reseña"}
      </button>
    </form>
  );
}

function Lightbox({ photos, i, onClose, onMove }: { photos: string[]; i: number; onClose: () => void; onMove: (i: number) => void }) {
  return (
    <div role="dialog" aria-modal="true" aria-label="Foto de la reseña" className="fixed inset-0 z-[80] grid place-items-center bg-ink/85 p-4 backdrop-blur-md" onClick={onClose} onKeyDown={(e) => { if (e.key === "Escape") onClose(); if (e.key === "ArrowRight") onMove((i + 1) % photos.length); if (e.key === "ArrowLeft") onMove((i - 1 + photos.length) % photos.length); }} tabIndex={-1}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={photos[i]} alt={`Foto ${i + 1} de ${photos.length}`} className="panel-in max-h-[82vh] max-w-full rounded-[24px] object-contain shadow-2xl" onClick={(e) => e.stopPropagation()} />
      <button type="button" autoFocus onClick={onClose} className="glass-dark absolute right-5 top-5 grid size-11 place-items-center rounded-full text-ivory" aria-label="Cerrar">✕</button>
      {photos.length > 1 && (
        <div className="absolute bottom-6 flex gap-3" onClick={(e) => e.stopPropagation()}>
          <button type="button" onClick={() => onMove((i - 1 + photos.length) % photos.length)} className="glass-dark grid size-11 place-items-center rounded-full text-ivory" aria-label="Anterior">←</button>
          <span className="glass-dark grid place-items-center rounded-full px-4 text-xs text-ivory">{i + 1} / {photos.length}</span>
          <button type="button" onClick={() => onMove((i + 1) % photos.length)} className="glass-dark grid size-11 place-items-center rounded-full text-ivory" aria-label="Siguiente">→</button>
        </div>
      )}
    </div>
  );
}
