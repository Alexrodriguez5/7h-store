"use client";

/* eslint-disable @next/next/no-img-element -- miniaturas de productos y de fotos locales (blob:) */
import Link from "next/link";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { BUSINESS, whatsappUrl } from "@/lib/business";
import { describeKinds, scanPrivate } from "@/lib/aura/privacy";
import type { ChatReply } from "@/lib/aura/chat";
import type { Handoff, ProductCard, RequestDraft } from "@/lib/aura/tools";
import { AuraDraftCard } from "./AuraDraftCard";
import { AuraOrb, MOOD_ENERGY, type AuraMood } from "./AuraOrb";

type Msg =
  | { id: string; role: "user"; text: string; files: number }
  | { id: string; role: "aura"; source: "ia" | "sistema"; text: string; state: ChatReply["state"]; products: ProductCard[]; draft: RequestDraft | null; handoff: Handoff | null; fallback: boolean }
  | { id: string; role: "done"; code: string; link: string | null };

const NOTICE = "AURA se encuentra en una fase de prueba. Evita compartir datos personales, bancarios o información confidencial en el chat. Las fotografías y archivos que adjuntes se almacenan de forma privada para que nuestro equipo pueda revisarlos.";
const STORE_KEY = "7h-aura-v1";
const MAX_FILES = 4;
const MAX_BYTES = 4 * 1024 * 1024;
const uid = () => Math.random().toString(36).slice(2, 10);
const safe = <T,>(fn: () => T, fb: T): T => { try { return fn(); } catch { return fb; } };

/** Texto con **negritas** y saltos de línea, sin HTML (nada de lo que llega se interpreta como marcado). */
function rich(text: string): ReactNode[] {
  return text.split("\n").flatMap((line, li) => {
    const parts = line.split(/(\*\*[^*]+\*\*)/g).map((p, i) => (p.startsWith("**") && p.endsWith("**") ? <strong key={i} className="font-semibold text-ivory">{p.slice(2, -2)}</strong> : <span key={i}>{p}</span>));
    return li === 0 ? parts : [<br key={`br${li}`} />, ...parts];
  });
}

export function AuraWidget() {
  const [open, setOpen] = useState(false);
  const [accepted, setAccepted] = useState(false);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [conv, setConv] = useState<string | null>(null);
  const [text, setText] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [links, setLinks] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<{ enabled: boolean; signedIn: boolean; proposals: { code: string; productName: string }[] } | null>(null);
  const [fileError, setFileError] = useState<string>();
  const energy = useRef(MOOD_ENERGY.idle);
  const mood = useRef<AuraMood>("idle");
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const wa = whatsappUrl(BUSINESS.whatsapp);

  const setMood = useCallback((m: AuraMood, ms?: number) => {
    mood.current = m;
    energy.current = MOOD_ENERGY[m];
    if (ms) window.setTimeout(() => { if (mood.current === m) { mood.current = "idle"; energy.current = MOOD_ENERGY.idle; } }, ms);
  }, []);

  // Conversación de esta pestaña (sobrevive a la navegación). Nada de esto sale del navegador.
  useEffect(() => {
    const s = safe(() => JSON.parse(sessionStorage.getItem(STORE_KEY) ?? "null"), null) as { conv: string | null; msgs: Msg[]; links: string[] } | null;
    if (s) { setConv(s.conv); setMsgs(s.msgs.slice(-40)); setLinks(s.links ?? []); }
    setAccepted(safe(() => localStorage.getItem(`${STORE_KEY}:aviso`) === "1", false));
  }, []);
  useEffect(() => { safe(() => sessionStorage.setItem(STORE_KEY, JSON.stringify({ conv, msgs: msgs.slice(-40), links })), undefined); }, [conv, msgs, links]);
  useEffect(() => { listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" }); }, [msgs, busy]);

  useEffect(() => {
    if (!open) return;
    setMood("welcome", 900);
    fetch("/api/aura/estado").then((r) => r.json()).then(setStatus).catch(() => setStatus({ enabled: false, signedIn: false, proposals: [] }));
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    window.addEventListener("keydown", onKey);
    const t = window.setTimeout(() => inputRef.current?.focus(), 250);
    return () => { window.removeEventListener("keydown", onKey); clearTimeout(t); };
  }, [open, setMood]);

  const check = scanPrivate(text);

  const addFiles = (list: FileList | null) => {
    setFileError(undefined);
    const next = [...files];
    for (const f of Array.from(list ?? [])) {
      if (!/^image\/(jpeg|png|webp)$/.test(f.type)) { setFileError("Por ahora puedes adjuntar fotos o capturas (JPG, PNG o WebP)."); continue; }
      if (next.length >= MAX_FILES) { setFileError(`Máximo ${MAX_FILES} fotos.`); break; }
      next.push(f);
    }
    if (next.reduce((s, f) => s + f.size, 0) > MAX_BYTES) { setFileError("Las fotos superan 4 MB en total."); return; }
    setFiles(next);
  };

  const send = async () => {
    const message = text.trim();
    if (!message || busy) return;
    if (check.block) { setMood("error", 1200); return; }
    const found = (message.match(/https?:\/\/[^\s<>"']+/gi) ?? []).slice(0, 5);
    if (found.length) setLinks((l) => [...new Set([...l, ...found])].slice(0, 5));
    setMsgs((m) => [...m, { id: uid(), role: "user", text: check.text, files: files.length }]);
    setBusy(true);
    setMood("thinking");
    let reply: ChatReply | null = null;
    try {
      const r = await fetch("/api/aura/chat", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ conversationId: conv, message, attachments: files.length }) });
      const data = await r.json().catch(() => null);
      reply = data && "source" in data ? (data as ChatReply) : null;
      if (!reply) throw new Error(String(data?.error ?? "error"));
    } catch {
      reply = { conversationId: conv, source: "sistema", text: "No pudimos conectar con AURA. Tu mensaje sigue escrito: inténtalo de nuevo o usa el asistente guiado.", state: "error", products: [], draft: null, handoff: null, privacy: [], fallback: true };
    }
    setBusy(false);
    if (reply.conversationId) setConv(reply.conversationId);
    setMsgs((m) => [...m, { id: uid(), role: "aura", source: reply.source, text: reply.text, state: reply.state, products: reply.products, draft: reply.draft, handoff: reply.handoff, fallback: reply.fallback }]);
    // El mensaje se conserva escrito si no lo atendió la IA (cuota, error, privacidad).
    if (reply.state === "ok") { setText(""); setMood("responding", 1400); }
    else setMood("error", 1600);
  };

  const lastDraft = [...msgs].reverse().find((m) => m.role === "aura" && m.draft) as Extract<Msg, { role: "aura" }> | undefined;
  const created = msgs.some((m) => m.role === "done");

  return (
    <>
      {/* Lanzador: la esfera de AURA ocupa la esquina; WhatsApp vive dentro del panel. */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls="aura-panel"
        aria-label={open ? "Cerrar AURA" : "Abrir AURA, asesora de 7H STORE"}
        className={`group fixed bottom-4 right-4 z-40 grid size-16 place-items-center rounded-full bg-ink shadow-[0_10px_30px_-8px_rgb(201_164_76_/_.55)] ring-1 ring-gold/40 transition-transform duration-300 hover:scale-105 focus-visible:outline-gold sm:bottom-5 sm:right-5 ${open ? "max-sm:hidden" : ""}`}
      >
        <AuraOrb energy={energy} className="size-12" fps={20} />
        <span className="pointer-events-none absolute right-[calc(100%+10px)] whitespace-nowrap rounded-full bg-ink px-3 py-1.5 text-xs font-semibold text-gold-light opacity-0 ring-1 ring-gold/30 transition-opacity group-hover:opacity-100 max-sm:hidden">Pregúntale a AURA</span>
      </button>

      {open && (
        <section
          id="aura-panel"
          role="dialog"
          aria-label="AURA, asesora de 7H STORE"
          className="aura-panel fixed inset-x-0 bottom-0 z-50 flex h-[88dvh] flex-col overflow-hidden rounded-t-[28px] border border-gold/25 bg-[#111110] text-ivory shadow-[0_-20px_60px_-20px_rgb(0_0_0_/_.7)] sm:inset-x-auto sm:bottom-24 sm:right-5 sm:h-[640px] sm:max-h-[calc(100dvh-8rem)] sm:w-[400px] sm:rounded-[28px]"
        >
          <header className="flex items-center gap-3 border-b border-white/10 px-4 py-3">
            <AuraOrb energy={energy} className="size-10" fps={30} />
            <div className="min-w-0 flex-1">
              <p className="font-display text-xl leading-none text-gold-light">AURA</p>
              <p className="mt-1 text-[11px] text-ivory/55">Asesora de 7H STORE · fase de prueba</p>
            </div>
            {wa && <a href={`${wa}?text=${encodeURIComponent("Hola 7H STORE, tengo una pregunta.")}`} target="_blank" rel="noreferrer" className="grid min-h-11 place-items-center rounded-full border border-white/15 px-3 text-xs font-semibold text-ivory hover:border-gold" aria-label="Escribir por WhatsApp">WhatsApp</a>}
            <button type="button" onClick={() => setOpen(false)} aria-label="Cerrar AURA" className="grid size-11 place-items-center rounded-full text-ivory/70 hover:bg-white/10 hover:text-ivory">
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg>
            </button>
          </header>

          <div ref={listRef} className="flex-1 space-y-3 overflow-y-auto overscroll-contain px-4 py-4" aria-live="polite">
            <div className="rounded-2xl border border-gold/20 bg-gold/[.06] p-3 text-xs leading-5 text-ivory/80">
              <p>{NOTICE}</p>
              <p className="mt-1.5"><Link href="/privacidad" className="underline underline-offset-2">Política de tratamiento de datos</Link>. Durante esta fase, la conversación se procesa con el nivel gratuito de Google Gemini, sin garantías de privacidad empresarial.</p>
              {!accepted && <button type="button" onClick={() => { setAccepted(true); safe(() => localStorage.setItem(`${STORE_KEY}:aviso`, "1"), undefined); }} className="mt-2 min-h-11 rounded-full bg-gold px-4 text-xs font-semibold text-ink">Entendido, empezar</button>}
            </div>

            {status?.proposals.map((p) => (
              <Link key={p.code} href={`/cuenta/busquedas/${p.code}`} className="block rounded-2xl border border-gold/40 p-3 text-sm hover:bg-white/[.04]">
                <span className="text-[11px] font-semibold uppercase tracking-[.14em] text-gold-light">Propuesta del equipo</span>
                <span className="mt-1 block">Tienes alternativas para «{p.productName}» ({p.code}). Ver y elegir →</span>
              </Link>
            ))}

            {msgs.length === 0 && accepted && (
              <div className="text-sm leading-6 text-ivory/85">
                <p>¡Hola! Soy AURA. ¿Qué estás buscando hoy? Puedo ayudarte a encontrar productos, resolver dudas de compra, envíos y garantías, o conseguir algo que no veas en la tienda.</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {["¿Cómo compro?", "Busco unos tenis", "No encuentro un producto"].map((q) => (
                    <button key={q} type="button" onClick={() => { setText(q); inputRef.current?.focus(); }} className="min-h-11 rounded-full border border-white/15 px-3 text-xs hover:border-gold">{q}</button>
                  ))}
                </div>
                {status && !status.enabled && <p className="mt-3 text-xs text-ivory/55">La asistencia inteligente no está activa ahora. Puedes usar el <Link href="/tu-lo-buscas" className="underline">asistente guiado</Link> o WhatsApp.</p>}
              </div>
            )}

            {msgs.map((m) => {
              if (m.role === "user") return (
                <div key={m.id} className="ml-auto max-w-[85%] rounded-2xl rounded-br-md bg-gold/90 px-3.5 py-2.5 text-sm text-ink">
                  {m.text}{m.files > 0 && <span className="mt-1 block text-[11px] opacity-70">{m.files} foto(s) adjunta(s)</span>}
                </div>
              );
              if (m.role === "done") return (
                <div key={m.id} role="status" className="rounded-2xl border border-gold/40 bg-gold/10 p-3 text-sm">
                  <p className="font-semibold text-gold-light">Solicitud registrada: {m.code}</p>
                  <p className="mt-1 text-xs text-ivory/75">Nuestro equipo revisará la información y te enviará alternativas. Te avisamos por correo.</p>
                  {m.link && <Link href={m.link} className="mt-2 inline-block text-xs font-semibold underline">Ver mi solicitud</Link>}
                </div>
              );
              return (
                <div key={m.id} className="max-w-[92%] space-y-2">
                  <div className={`rounded-2xl rounded-bl-md px-3.5 py-2.5 text-sm leading-6 ${m.source === "ia" ? "bg-white/[.06] text-ivory/90" : "border border-white/15 text-ivory/80"}`}>
                    {m.source === "sistema" && <span className="mb-1 block text-[10px] font-semibold uppercase tracking-[.14em] text-ivory/45">Mensaje automático</span>}
                    {rich(m.text)}
                  </div>
                  {m.products.length > 0 && (
                    <div className="-mx-1 flex snap-x gap-2 overflow-x-auto px-1 pb-1">
                      {m.products.map((p) => (
                        <Link key={p.slug} href={p.url} className="w-40 shrink-0 snap-start overflow-hidden rounded-xl border border-white/10 bg-white/[.03] hover:border-gold/50">
                          {p.image && <img src={p.image} alt="" loading="lazy" className="aspect-square w-full object-cover" />}
                          <span className="block p-2 text-xs">
                            <span className="block text-ivory/55">{p.brand}</span>
                            <span className="line-clamp-2 font-semibold">{p.name}</span>
                            <span className="mt-1 block text-gold-light">{p.price}</span>
                            <span className="block text-[11px] text-ivory/50">{p.soldOut ? "Agotado" : p.sizes.length ? `Tallas: ${p.sizes.slice(0, 6).join(", ")}` : "Disponible"}</span>
                          </span>
                        </Link>
                      ))}
                    </div>
                  )}
                  {m.handoff && (
                    <div className="flex flex-wrap gap-2">
                      {m.handoff.whatsapp && <a href={m.handoff.whatsapp} target="_blank" rel="noreferrer" className="min-h-11 rounded-full bg-[#25D366] px-4 py-3 text-xs font-semibold text-white">WhatsApp</a>}
                      <Link href={m.handoff.contact} className="min-h-11 rounded-full border border-white/20 px-4 py-3 text-xs">Contacto</Link>
                      <Link href={m.handoff.pqr} className="min-h-11 rounded-full border border-white/20 px-4 py-3 text-xs">Garantías y PQR</Link>
                    </div>
                  )}
                  {m.fallback && <Link href="/tu-lo-buscas" className="inline-flex min-h-11 items-center rounded-full border border-gold/40 px-4 text-xs font-semibold text-gold-light hover:bg-gold/10">Usar el asistente guiado</Link>}
                </div>
              );
            })}

            {lastDraft?.draft && conv && !created && (
              <AuraDraftCard
                key={lastDraft.id}
                draft={lastDraft.draft}
                conversationId={conv}
                files={files}
                links={links}
                signedIn={!!status?.signedIn}
                onCreated={(r) => { setMsgs((m) => [...m, { id: uid(), role: "done", code: r.code, link: r.link }]); setFiles([]); setMood("welcome", 900); }}
              />
            )}

            {busy && (
              <div className="flex items-center gap-2 text-xs text-ivory/55" role="status">
                <span className="aura-dots" aria-hidden="true"><i /><i /><i /></span> AURA está pensando…
              </div>
            )}
          </div>

          <form
            onSubmit={(e) => { e.preventDefault(); void send(); }}
            className="border-t border-white/10 p-3 pb-[max(.75rem,env(safe-area-inset-bottom))]"
          >
            {files.length > 0 && (
              <div className="mb-2 flex gap-2 overflow-x-auto">
                {files.map((f, i) => (
                  <span key={`${f.name}-${i}`} className="relative shrink-0">
                    <img src={URL.createObjectURL(f)} alt={`Adjunto ${i + 1}`} className="size-14 rounded-lg object-cover" />
                    <button type="button" onClick={() => setFiles((l) => l.filter((_, j) => j !== i))} aria-label={`Quitar adjunto ${i + 1}`} className="absolute -right-1.5 -top-1.5 grid size-6 place-items-center rounded-full bg-ink text-xs ring-1 ring-white/30">×</button>
                  </span>
                ))}
              </div>
            )}
            {(check.kinds.length > 0 || fileError) && (
              <p role="alert" className={`mb-2 text-xs ${check.block || fileError ? "text-[#f3a7a7]" : "text-gold-light"}`}>
                {fileError ?? (check.block ? `No envíes ${describeKinds(check.kinds)} por el chat. Quítalo para continuar.` : `Quitaremos ${describeKinds(check.kinds)} antes de enviar tu mensaje.`)}
              </p>
            )}
            <div className="flex items-end gap-2">
              <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" multiple hidden onChange={(e) => { addFiles(e.target.files); e.target.value = ""; }} />
              <button type="button" onClick={() => fileRef.current?.click()} disabled={!accepted} aria-label="Adjuntar fotos" className="grid size-11 shrink-0 place-items-center rounded-full border border-white/15 text-ivory/80 hover:border-gold disabled:opacity-40">
                <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="M21 12.5l-8.4 8.4a5 5 0 0 1-7.1-7.1l8.5-8.5a3.3 3.3 0 0 1 4.7 4.7l-8.5 8.5a1.7 1.7 0 0 1-2.4-2.4l7.8-7.8" /></svg>
              </button>
              <label className="sr-only" htmlFor="aura-input">Mensaje para AURA</label>
              <textarea
                id="aura-input"
                ref={inputRef}
                rows={1}
                value={text}
                disabled={!accepted}
                onChange={(e) => { setText(e.target.value); if (mood.current === "idle" || mood.current === "listening") setMood("listening", 1500); }}
                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void send(); } }}
                maxLength={1200}
                placeholder={accepted ? "Escribe tu mensaje…" : "Acepta el aviso para empezar"}
                className="max-h-32 min-h-11 flex-1 resize-none overflow-y-auto rounded-2xl [scrollbar-width:none] border border-white/15 bg-white/[.04] px-3.5 py-2.5 text-base text-ivory outline-none placeholder:text-ivory/35 focus:border-gold sm:text-sm"
              />
              <button type="submit" disabled={!accepted || busy || !text.trim() || check.block} aria-label="Enviar mensaje" className="grid size-11 shrink-0 place-items-center rounded-full bg-gold text-ink transition-colors hover:bg-gold-light disabled:opacity-40">
                <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
              </button>
            </div>
          </form>
        </section>
      )}
    </>
  );
}
