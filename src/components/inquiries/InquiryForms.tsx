"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { useFieldGuard } from "@/components/ui/useFieldGuard";
import { emailField, freeText, personName } from "@/lib/validation/fields";

const field = "mt-1 w-full rounded-xl border border-ink/15 bg-white px-3.5 py-3 text-sm font-normal outline-none transition-shadow focus:border-gold focus:shadow-[0_0_0_4px_rgb(201_164_76_/_.15)]";

async function postJson(url: string, data: unknown) {
  try {
    const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });
    const json = (await res.json().catch(() => ({}))) as Record<string, string>;
    return { ok: res.ok, data: json, error: res.ok ? undefined : json.error ?? "No se pudo enviar." };
  } catch {
    return { ok: false, data: {} as Record<string, string>, error: "Sin conexión. Revisa tu internet e inténtalo de nuevo." };
  }
}

/** Nueva consulta: temas claros, sin cuenta obligatoria. Al enviar lleva a la conversación. */
export function NewInquiryForm({ topics, defaults }: { topics: { value: string; label: string }[]; defaults: { name?: string; email?: string; topic?: string; productSlug?: string; subject?: string } }) {
  const router = useRouter();
  const [v, setV] = useState({ name: defaults.name ?? "", email: defaults.email ?? "", topic: defaults.topic ?? "DISPONIBILIDAD", subject: defaults.subject ?? "", message: "", website: "" });
  const [consent, setConsent] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string>();
  const set = (k: keyof typeof v) => (e: { target: { value: string } }) => setV((p) => ({ ...p, [k]: e.target.value }));
  const g = useFieldGuard();
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    // Mismas reglas que /api/consultas: si algo no cumple, se marca el campo y no se envía.
    if (!g.check({ name: v.name, email: v.email, subject: v.subject, message: v.message })) return;
    setSending(true);
    setError(undefined);
    const r = await postJson("/api/consultas", { ...v, productSlug: defaults.productSlug ?? "", consent });
    if (!r.ok) {
      setSending(false);
      return setError(r.error);
    }
    router.push(r.data.link);
  };
  return (
    <form onSubmit={submit} className="surface relative space-y-5 rounded-[28px] p-6 sm:p-9" noValidate>
      <fieldset>
        <legend className="text-xs font-semibold">¿Sobre qué quieres hablar?</legend>
        <div className="mt-2 flex flex-wrap gap-2">
          {topics.map((t) => (
            <label key={t.value} className={`cursor-pointer rounded-full border px-3.5 py-2 text-xs transition-colors ${v.topic === t.value ? "border-ink bg-ink font-semibold text-gold-light" : "border-ink/15 bg-white/70 hover:border-gold"}`}>
              <input type="radio" name="topic" value={t.value} checked={v.topic === t.value} onChange={set("topic")} className="sr-only" />
              {t.label}
            </label>
          ))}
        </div>
      </fieldset>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block text-xs font-semibold">Tu nombre *<input required value={v.name} maxLength={80} className={field} {...g.field("name", "name", set("name"), { schema: personName(2, 80), required: true, requiredMessage: "Escribe tu nombre." })} /><g.Msg name="name" /></label>
        <label className="block text-xs font-semibold">Correo electrónico *<input required type="email" value={v.email} maxLength={254} className={field} {...g.field("email", "email", set("email"), { schema: emailField, required: true, requiredMessage: "Escribe tu correo." })} /><g.Msg name="email" /></label>
      </div>
      <label className="block text-xs font-semibold">Asunto *<input required value={v.subject} maxLength={120} className={field} {...g.field("subject", null, set("subject"), { schema: freeText(120, 3, "Escribe el asunto (mínimo 3 caracteres)."), required: true, requiredMessage: "Escribe el asunto." })} /><g.Msg name="subject" /></label>
      <label className="block text-xs font-semibold">Tu mensaje *<textarea required rows={5} value={v.message} {...g.field("message", null, set("message"), { schema: freeText(2000, 5, "Escribe un poco más (mínimo 5 caracteres)."), required: true, requiredMessage: "Escribe tu mensaje." })} maxLength={2000} placeholder="Cuéntanos con detalle. Si es sobre un pedido, incluye su número (por ejemplo, 7H-K4M9QX)." className={field} /><g.Msg name="message" /></label>
      <input type="text" tabIndex={-1} autoComplete="off" aria-hidden="true" value={v.website} onChange={set("website")} className="absolute -left-[9999px] h-0 w-0 opacity-0" name="website" />
      <label className="flex items-start gap-3 text-xs leading-5 text-ink-soft">
        <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="mt-0.5 size-4 accent-[#0a0a0a]" />
        <span>Autorizo a 7H STORE a usar mi nombre y correo para responder esta consulta, según la <Link href="/privacidad" className="underline">política de privacidad</Link>.</span>
      </label>
      {error && <p role="alert" className="text-sm text-error">{error}</p>}
      <button type="submit" disabled={sending} className="btn-shine w-full rounded-full bg-ink py-3.5 text-sm font-semibold text-ivory transition-colors hover:bg-gold hover:text-ink disabled:opacity-60 sm:w-auto sm:px-10">
        {sending ? "Enviando…" : "Enviar consulta"}
      </button>
    </form>
  );
}

/** Responder dentro de una conversación existente. */
export function InquiryReplyForm({ code, token }: { code: string; token?: string }) {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string>();
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setSending(true);
    setError(undefined);
    const r = await postJson(`/api/consultas/${code}/mensajes`, { message, t: token });
    setSending(false);
    if (!r.ok) return setError(r.error);
    setMessage("");
    router.refresh();
  };
  return (
    <form onSubmit={submit} className="surface mt-6 rounded-[24px] p-4 sm:p-5">
      <label className="block text-xs font-semibold">
        Escribe tu respuesta
        <textarea required rows={3} value={message} onChange={(e) => setMessage(e.target.value)} maxLength={2000} className={field} />
      </label>
      {error && <p role="alert" className="mt-2 text-sm text-error">{error}</p>}
      <div className="mt-3 flex justify-end">
        <button type="submit" disabled={sending || message.trim().length < 5} className="rounded-full bg-ink px-6 py-2.5 text-sm font-semibold text-ivory transition-colors hover:bg-gold hover:text-ink disabled:opacity-50">{sending ? "Enviando…" : "Enviar"}</button>
      </div>
    </form>
  );
}
