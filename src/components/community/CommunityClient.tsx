"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { PhotoPicker, postMultipart } from "@/components/ugc/PhotoPicker";

const field = "mt-1 w-full rounded-xl border border-ink/15 bg-white px-3.5 py-3 text-sm font-normal outline-none focus:border-gold focus:shadow-[0_0_0_4px_rgb(201_164_76_/_.15)]";

async function postJson(url: string, data?: unknown) {
  try {
    const res = await fetch(url, { method: "POST", headers: data ? { "Content-Type": "application/json" } : undefined, body: data ? JSON.stringify(data) : undefined });
    const json = (await res.json().catch(() => ({}))) as Record<string, unknown> & { error?: string };
    return { ok: res.ok, status: res.status, data: json, error: res.ok ? undefined : json.error ?? "No se pudo completar." };
  } catch {
    return { ok: false, status: 0, data: {} as Record<string, unknown>, error: "Sin conexión." };
  }
}

/** Formulario de nueva publicación. */
export function NewPostForm({ categories, defaultCategory }: { categories: { value: string; label: string }[]; defaultCategory?: string }) {
  const router = useRouter();
  const [v, setV] = useState({ category: defaultCategory ?? categories[0].value, title: "", body: "", alias: "", website: "" });
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const [pending, setPending] = useState(false);
  const set = (k: keyof typeof v) => (e: { target: { value: string } }) => setV((p) => ({ ...p, [k]: e.target.value }));
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(undefined);
    const r = await postMultipart("/api/comunidad", v, files);
    setBusy(false);
    if (!r.ok) return setError(r.error);
    if (r.data.status === "PENDIENTE") return setPending(true);
    router.push(`/comunidad/${String(r.data.id)}`);
  };
  if (pending) {
    return (
      <div role="status" className="surface panel-in rounded-[28px] p-8 text-center">
        <p className="type-h3">¡Gracias por participar!</p>
        <p className="mx-auto mt-2 max-w-md text-sm text-ink-soft">Como es tu primera publicación, el equipo la revisa antes de mostrarla. Las siguientes saldrán de inmediato.</p>
        <Link href="/comunidad" className="mt-5 inline-flex rounded-full bg-ink px-6 py-3 text-sm font-semibold text-ivory transition-colors hover:bg-gold hover:text-ink">Volver a la comunidad</Link>
      </div>
    );
  }
  return (
    <form onSubmit={submit} className="surface relative space-y-5 rounded-[28px] p-6 sm:p-9" noValidate>
      <fieldset>
        <legend className="text-xs font-semibold">Tema</legend>
        <div className="mt-2 flex flex-wrap gap-2">
          {categories.map((c) => (
            <label key={c.value} className={`cursor-pointer rounded-full border px-3.5 py-2 text-xs transition-colors ${v.category === c.value ? "border-ink bg-ink font-semibold text-gold-light" : "border-ink/15 bg-white/70 hover:border-gold"}`}>
              <input type="radio" name="category" value={c.value} checked={v.category === c.value} onChange={set("category")} className="sr-only" />
              {c.label}
            </label>
          ))}
        </div>
      </fieldset>
      <label className="block text-xs font-semibold">Título *<input required value={v.title} onChange={set("title")} maxLength={120} className={field} /></label>
      <label className="block text-xs font-semibold">Tu publicación *<textarea required rows={6} value={v.body} onChange={set("body")} maxLength={3000} className={field} placeholder="Comparte una recomendación, haz una pregunta o cuéntanos qué te gustaría ver en 7H." /></label>
      <label className="block text-xs font-semibold">Nombre público (opcional)<input value={v.alias} onChange={set("alias")} maxLength={40} placeholder="Ej.: Laura M." className={field} /></label>
      <div><p className="mb-2 text-xs font-semibold">Foto (opcional)</p><PhotoPicker files={files} onChange={setFiles} max={1} label="Agregar foto" /></div>
      <input type="text" tabIndex={-1} autoComplete="off" aria-hidden="true" value={v.website} onChange={set("website")} className="absolute -left-[9999px] h-0 w-0 opacity-0" name="website" />
      <p className="text-[11px] leading-5 text-ink-soft">Sé respetuoso. No compartas datos personales ni enlaces. El equipo puede ocultar contenido que incumpla las normas.</p>
      {error && <p role="alert" className="text-sm text-error">{error}</p>}
      <button type="submit" disabled={busy} className="btn-shine w-full rounded-full bg-ink py-3.5 text-sm font-semibold text-ivory transition-colors hover:bg-gold hover:text-ink disabled:opacity-60 sm:w-auto sm:px-10">{busy ? "Publicando…" : "Publicar"}</button>
    </form>
  );
}

/** "Me gusta" de una publicación. */
export function ReactButton({ postId, count, loggedIn }: { postId: string; count: number; loggedIn: boolean }) {
  const [n, setN] = useState(count);
  const [on, setOn] = useState(false);
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={async () => {
        if (!loggedIn) return window.location.assign(`/cuenta?next=/comunidad/${postId}`);
        const r = await postJson(`/api/comunidad/${postId}/reaccion`);
        if (r.ok) { setN(Number(r.data.count)); setOn(Boolean(r.data.reacted)); }
      }}
      className={`rounded-full border px-3.5 py-1.5 text-xs transition-colors ${on ? "border-gold bg-gold/15 font-semibold" : "border-ink/15 hover:border-gold"}`}
    >
      ♥ Me gusta{n > 0 ? ` · ${n}` : ""}
    </button>
  );
}

/** Reportar contenido inapropiado. */
export function ReportButton({ postId, commentId, loggedIn }: { postId?: string; commentId?: string; loggedIn: boolean }) {
  const [done, setDone] = useState(false);
  if (done) return <span className="text-[11px] text-ink-soft">Gracias, lo revisaremos.</span>;
  return (
    <button
      type="button"
      onClick={async () => {
        if (!loggedIn) return window.location.assign("/cuenta?next=/comunidad");
        const reason = window.prompt("¿Por qué reportas este contenido?");
        if (!reason || reason.trim().length < 3) return;
        const r = await postJson("/api/comunidad/reportes", { postId, commentId, reason: reason.trim().slice(0, 300) });
        if (r.ok) setDone(true);
      }}
      className="text-[11px] text-ink-soft underline-offset-2 hover:text-error hover:underline"
    >
      Reportar
    </button>
  );
}

/** Comentar o responder un comentario. */
export function CommentForm({ postId, parentId, onDone }: { postId: string; parentId?: string; onDone?: () => void }) {
  const router = useRouter();
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setError(undefined);
        const r = await postJson(`/api/comunidad/${postId}/comentarios`, { body, parentId });
        setBusy(false);
        if (!r.ok) return setError(r.error);
        setBody("");
        onDone?.();
        router.refresh();
      }}
      className="flex flex-col gap-2 sm:flex-row sm:items-start"
    >
      <label className="sr-only" htmlFor={`c-${parentId ?? postId}`}>{parentId ? "Tu respuesta" : "Tu comentario"}</label>
      <textarea id={`c-${parentId ?? postId}`} rows={2} value={body} onChange={(e) => setBody(e.target.value)} maxLength={1500} placeholder={parentId ? "Escribe tu respuesta" : "Escribe un comentario"} className={`${field} !mt-0 flex-1`} />
      <button type="submit" disabled={busy || body.trim().length < 2} className="rounded-full bg-ink px-5 py-3 text-sm font-semibold text-ivory transition-colors hover:bg-gold hover:text-ink disabled:opacity-50">{busy ? "…" : parentId ? "Responder" : "Comentar"}</button>
      {error && <p role="alert" className="text-xs text-error sm:basis-full">{error}</p>}
    </form>
  );
}

export function ReplyToggle({ postId, parentId }: { postId: string; parentId: string }) {
  const [open, setOpen] = useState(false);
  return open ? (
    <div className="mt-2"><CommentForm postId={postId} parentId={parentId} onDone={() => setOpen(false)} /></div>
  ) : (
    <button type="button" onClick={() => setOpen(true)} className="text-[11px] font-semibold underline-offset-2 hover:underline">Responder</button>
  );
}
