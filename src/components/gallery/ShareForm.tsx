"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { PhotoPicker, postMultipart } from "@/components/ugc/PhotoPicker";

const field = "mt-1 w-full rounded-xl border border-ink/15 bg-white px-3.5 py-3 text-sm font-normal outline-none focus:border-gold focus:shadow-[0_0_0_4px_rgb(201_164_76_/_.15)]";

export interface OwnMedia { id: string; status: string; caption: string | null }
const LABEL: Record<string, string> = { PENDIENTE: "En revisión", APROBADA: "Publicada", RECHAZADA: "No publicada", OCULTA: "Oculta" };

/** Compartir una foto con autorización expresa, y ver o retirar las propias. */
export function ShareForm({ loggedIn, verified, own }: { loggedIn: boolean; verified: boolean; own: OwnMedia[] }) {
  const router = useRouter();
  const [files, setFiles] = useState<File[]>([]);
  const [caption, setCaption] = useState("");
  const [alias, setAlias] = useState("");
  const [website, setWebsite] = useState("");
  const [consent, setConsent] = useState(false);
  const [sending, setSending] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string }>();

  if (!loggedIn) {
    return (
      <div className="surface rounded-[24px] p-6 text-sm">
        <p className="type-h3">Comparte tu foto</p>
        <p className="mt-2 text-ink-soft">Inicia sesión para compartir cómo luce tu compra. Revisamos cada foto antes de publicarla.</p>
        <Link href="/cuenta?next=/asi-se-vive-7h" className="mt-4 inline-flex rounded-full bg-ink px-6 py-3 font-semibold text-ivory transition-colors hover:bg-gold hover:text-ink">Iniciar sesión</Link>
      </div>
    );
  }
  if (!verified) return <p className="surface rounded-2xl p-5 text-sm">Primero confirma tu correo con el enlace que te enviamos.</p>;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!files.length) return setMsg({ ok: false, text: "Elige una foto." });
    setSending(true);
    setMsg(undefined);
    const r = await postMultipart("/api/galeria", { caption, alias, consent, website }, files);
    setSending(false);
    if (!r.ok) return setMsg({ ok: false, text: r.error ?? "No se pudo enviar." });
    setFiles([]);
    setCaption("");
    setMsg({ ok: true, text: "¡Gracias! La publicaremos cuando el equipo la revise." });
    router.refresh();
  };
  const withdraw = async (id: string) => {
    if (!window.confirm("¿Retirar esta foto? Dejará de verse de inmediato.")) return;
    await fetch(`/api/galeria/${id}/retirar`, { method: "POST" }).catch(() => null);
    router.refresh();
  };

  return (
    <div className="space-y-4">
      <form onSubmit={submit} className="surface relative space-y-4 rounded-[24px] p-6" noValidate>
        <p className="type-h3">Comparte tu foto</p>
        <PhotoPicker files={files} onChange={setFiles} max={1} label="Elegir foto" />
        <label className="block text-xs font-semibold">Descripción (opcional)<input value={caption} onChange={(e) => setCaption(e.target.value)} maxLength={140} className={field} /></label>
        <label className="block text-xs font-semibold">Nombre público (opcional)<input value={alias} onChange={(e) => setAlias(e.target.value)} maxLength={40} placeholder="Ej.: Laura M." className={field} /></label>
        <input type="text" tabIndex={-1} autoComplete="off" aria-hidden="true" value={website} onChange={(e) => setWebsite(e.target.value)} className="absolute -left-[9999px] h-0 w-0 opacity-0" name="website" />
        <label className="flex items-start gap-3 text-xs leading-5 text-ink-soft">
          <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="mt-0.5 size-4 accent-[#0a0a0a]" />
          <span>Soy autor de la foto y autorizo a 7H STORE a publicarla en su galería con mi nombre público. Puedo retirarla cuando quiera. No debe mostrar datos personales ni a otras personas sin su permiso.</span>
        </label>
        {msg && <p role="status" className={`text-sm ${msg.ok ? "text-success" : "text-error"}`}>{msg.text}</p>}
        <button type="submit" disabled={sending} className="btn-shine w-full rounded-full bg-ink py-3 text-sm font-semibold text-ivory transition-colors hover:bg-gold hover:text-ink disabled:opacity-60">{sending ? "Enviando…" : "Enviar para revisión"}</button>
      </form>
      {own.length > 0 && (
        <div className="surface rounded-[24px] p-5">
          <p className="type-eyebrow text-gold">Tus fotos</p>
          <ul className="mt-3 grid grid-cols-3 gap-2">
            {own.map((m) => (
              <li key={m.id} className="space-y-1">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={`/media/galeria/${m.id}`} alt={m.caption ?? "Tu foto"} loading="lazy" className="aspect-square w-full rounded-xl object-cover" />
                <p className="text-[10px] text-ink-soft">{LABEL[m.status] ?? m.status}</p>
                <button type="button" onClick={() => withdraw(m.id)} className="text-[11px] font-semibold underline-offset-2 hover:underline">Retirar</button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
