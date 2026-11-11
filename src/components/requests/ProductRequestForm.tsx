"use client";

import Link from "next/link";
import { z } from "zod";
import { useState, type FormEvent } from "react";
import { PhotoPicker, postMultipart } from "@/components/ugc/PhotoPicker";
import { useFieldGuard } from "@/components/ui/useFieldGuard";
import { emailField, freeText, moneyCOP, personName } from "@/lib/validation/fields";

const field = "mt-1 w-full rounded-xl border border-ink/15 bg-white px-3.5 py-3 text-sm font-normal outline-none transition-shadow focus:border-gold focus:shadow-[0_0_0_4px_rgb(201_164_76_/_.15)]";

/** Presupuesto: solo pesos enteros (el filtro ya quitó puntos de miles y símbolos). */
const budgetSchema = z.string().transform((t) => Number(t.replace(/\D/g, ""))).pipe(moneyCOP(200_000_000));

/** Formulario "Tú lo buscas": sin cuenta, una foto opcional, consentimiento explícito y radicado al final. */
export function ProductRequestForm({ defaults }: { defaults?: { name?: string; email?: string; productName?: string } }) {
  const [v, setV] = useState({ name: defaults?.name ?? "", email: defaults?.email ?? "", productName: defaults?.productName ?? "", brand: "", model: "", url: "", budget: "", comments: "", website: "" });
  const [consent, setConsent] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string>();
  const [code, setCode] = useState<string>();
  const set = (k: keyof typeof v) => (e: { target: { value: string } }) => setV((p) => ({ ...p, [k]: e.target.value }));

  const g = useFieldGuard();
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    // Mismas reglas que /api/tu-lo-buscas: si algo no cumple, se marca el campo y no se envía.
    if (!g.check({ name: v.name, email: v.email, productName: v.productName, budget: v.budget })) return;
    setSending(true);
    setError(undefined);
    const budget = v.budget.replace(/\D/g, "");
    const r = await postMultipart("/api/tu-lo-buscas", { ...v, budgetCOP: budget ? Number(budget) : null, consent }, files);
    setSending(false);
    if (!r.ok) return setError(r.error);
    setCode(String(r.data.code));
  };

  if (code) {
    return (
      <div role="status" className="surface panel-in rounded-[28px] p-8 text-center sm:p-12">
        <span className="mx-auto grid size-14 place-items-center rounded-full bg-ink text-gold-light">
          <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2.4" aria-hidden="true"><path className="draw-check" d="M5 12.5l4.5 4.5L19 7.5" /></svg>
        </span>
        <p className="type-h3 mt-5">Recibimos tu solicitud</p>
        <p className="mt-2 text-sm text-ink-soft">Radicado <strong className="font-mono text-ink">{code}</strong>. Te escribiremos a <strong className="text-ink">{v.email}</strong> cuando tengamos una respuesta.</p>
        <p className="mx-auto mt-4 max-w-md text-xs leading-5 text-ink-soft">Revisamos cada solicitud, pero no todos los productos se pueden conseguir. Te contaremos con honestidad si es posible.</p>
        <Link href="/catalogo" className="mt-6 inline-flex rounded-full bg-ink px-6 py-3 text-sm font-semibold text-ivory transition-colors hover:bg-gold hover:text-ink">Seguir explorando</Link>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="surface relative space-y-5 rounded-[28px] p-6 sm:p-9" noValidate>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block text-xs font-semibold">Tu nombre *<input required value={v.name} maxLength={80} className={field} {...g.field("name", "name", set("name"), { schema: personName(2, 80), required: true, requiredMessage: "Escribe tu nombre." })} /><g.Msg name="name" /></label>
        <label className="block text-xs font-semibold">Correo electrónico *<input required type="email" value={v.email} maxLength={254} className={field} {...g.field("email", "email", set("email"), { schema: emailField, required: true, requiredMessage: "Escribe tu correo." })} /><g.Msg name="email" /></label>
      </div>
      <label className="block text-xs font-semibold">¿Qué producto buscas? *<input required value={v.productName} {...g.field("productName", null, set("productName"), { schema: freeText(160, 2, "Cuéntanos qué producto buscas."), required: true, requiredMessage: "Cuéntanos qué producto buscas." })} maxLength={120} placeholder="Ej.: Tenis New Balance 9060" className={field} /><g.Msg name="productName" /></label>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block text-xs font-semibold">Marca<input value={v.brand} onChange={set("brand")} maxLength={60} className={field} /></label>
        <label className="block text-xs font-semibold">Modelo o referencia<input value={v.model} onChange={set("model")} maxLength={80} className={field} /></label>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block text-xs font-semibold">Enlace del producto (opcional)<input type="url" inputMode="url" value={v.url} onChange={set("url")} maxLength={500} placeholder="https://" className={field} /></label>
        <label className="block text-xs font-semibold">Presupuesto aproximado en COP (opcional)<input inputMode="numeric" value={v.budget} {...g.field("budget", "money", set("budget"), { schema: budgetSchema })} maxLength={12} placeholder="Ej.: 600000" className={field} /><g.Msg name="budget" /></label>
      </div>
      <label className="block text-xs font-semibold">Comentarios<textarea rows={3} value={v.comments} onChange={set("comments")} maxLength={1000} placeholder="Talla, color, para cuándo lo necesitas…" className={field} /></label>
      <div>
        <p className="mb-2 text-xs font-semibold">Fotos de referencia (opcional, hasta 4)</p>
        <PhotoPicker files={files} onChange={setFiles} max={4} label="Agregar foto" />
      </div>
      <input type="text" tabIndex={-1} autoComplete="off" aria-hidden="true" value={v.website} onChange={set("website")} className="absolute -left-[9999px] h-0 w-0 opacity-0" name="website" />
      <label className="flex items-start gap-3 text-xs leading-5 text-ink-soft">
        <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="mt-0.5 size-4 accent-[#0a0a0a]" />
        <span>Autorizo a 7H STORE a usar mi nombre y correo solo para responder esta solicitud, según la <Link href="/privacidad" className="underline">política de privacidad</Link>.</span>
      </label>
      {error && <p role="alert" className="text-sm text-error">{error}</p>}
      <button type="submit" disabled={sending} className="btn-shine w-full rounded-full bg-ink py-3.5 text-sm font-semibold text-ivory transition-colors hover:bg-gold hover:text-ink disabled:opacity-60 sm:w-auto sm:px-10">
        {sending ? "Enviando…" : "Enviar solicitud"}
      </button>
    </form>
  );
}
