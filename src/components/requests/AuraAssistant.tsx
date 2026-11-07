"use client";

import Link from "next/link";
import { useState } from "react";
import { PhotoPicker, postMultipart } from "@/components/ugc/PhotoPicker";
import { formatCOP } from "@/lib/format";

const field = "mt-1 w-full rounded-xl border border-ink/15 bg-white px-3.5 py-3 text-base font-normal outline-none transition-shadow focus:border-gold focus:shadow-[0_0_0_4px_rgb(201_164_76_/_.15)] sm:text-sm";

type Draft = {
  productName: string; comments: string; brand: string; model: string; color: string; size: string; features: string;
  budget: string; referenceStore: string; links: string[]; name: string; email: string; phone: string; website: string;
};

/**
 * Asistente guiado de AURA: preguntas breves, una a la vez. Todo es opcional salvo qué buscas y cómo responderte.
 * No es una IA: ayuda al cliente a precisar lo que necesita y muestra un resumen para confirmar ANTES de enviar.
 */
export function AuraAssistant({ defaults, source = "asistente" }: { defaults?: { name?: string; email?: string; productName?: string }; source?: "asistente" | "cuenta" | "portada" }) {
  const [step, setStep] = useState(0);
  const [d, setD] = useState<Draft>({ productName: defaults?.productName ?? "", comments: "", brand: "", model: "", color: "", size: "", features: "", budget: "", referenceStore: "", links: [], name: defaults?.name ?? "", email: defaults?.email ?? "", phone: "", website: "" });
  const [link, setLink] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [consent, setConsent] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string>();
  const [done, setDone] = useState<{ code: string; link: string | null; duplicate: boolean }>();
  const set = (k: keyof Draft) => (e: { target: { value: string } }) => setD((p) => ({ ...p, [k]: e.target.value }));

  const addLink = () => {
    const v = link.trim();
    if (!/^https?:\/\/\S+$/i.test(v)) return setError("Pega un enlace completo (empieza por https://).");
    if (d.links.length >= 5) return setError("Máximo 5 enlaces.");
    setError(undefined);
    setD((p) => ({ ...p, links: [...new Set([...p.links, v])] }));
    setLink("");
  };

  const steps = [
    {
      q: "¿Qué producto estás buscando?",
      help: "Dilo con tus palabras. No necesitas saber la marca ni la referencia exacta.",
      ok: d.productName.trim().length >= 2,
      body: (
        <>
          <label className="block text-xs font-semibold">Lo que buscas *<input value={d.productName} onChange={set("productName")} maxLength={160} placeholder="Ej.: iPhone 15 Pro azul de 256 GB · unos tenis como los de la foto" className={field} /></label>
          <label className="block text-xs font-semibold">Cuéntanos más (opcional)<textarea rows={3} value={d.comments} onChange={set("comments")} maxLength={2000} placeholder="Para qué lo necesitas, si es un regalo, para cuándo…" className={field} /></label>
        </>
      ),
    },
    {
      q: "¿Tienes alguna fotografía o enlace?",
      help: "Fotos, capturas de pantalla o el enlace de la tienda donde lo viste. Es opcional.",
      ok: true,
      body: (
        <>
          <PhotoPicker files={files} onChange={setFiles} max={4} label="Agregar foto" />
          <div>
            <label className="block text-xs font-semibold" htmlFor="aura-link">Enlace de referencia</label>
            <div className="mt-1 flex gap-2">
              <input id="aura-link" type="url" inputMode="url" value={link} onChange={(e) => setLink(e.target.value)} placeholder="https://" className={`${field} !mt-0`} />
              <button type="button" onClick={addLink} className="shrink-0 rounded-xl border border-ink/15 px-4 text-sm font-semibold hover:border-gold">Agregar</button>
            </div>
            {d.links.length > 0 && (
              <ul className="mt-2 space-y-1 text-xs">
                {d.links.map((l) => <li key={l} className="flex items-center justify-between gap-2 rounded-lg bg-ivory-200/70 px-3 py-2"><span className="truncate">{l}</span><button type="button" onClick={() => setD((p) => ({ ...p, links: p.links.filter((x) => x !== l) }))} aria-label="Quitar enlace" className="font-semibold">✕</button></li>)}
              </ul>
            )}
            <p className="mt-1 text-[11px] text-ink-soft">Guardamos el enlace como referencia para que el equipo lo revise.</p>
          </div>
        </>
      ),
    },
    {
      q: "¿Conoces la marca o la referencia?",
      help: "Si no la sabes, sigue adelante: con la descripción y la foto también podemos buscar.",
      ok: true,
      body: (
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block text-xs font-semibold">Marca<input value={d.brand} onChange={set("brand")} maxLength={60} className={field} /></label>
          <label className="block text-xs font-semibold">Modelo o referencia<input value={d.model} onChange={set("model")} maxLength={80} className={field} /></label>
        </div>
      ),
    },
    {
      q: "¿Algún color, talla o característica indispensable?",
      help: "Solo lo que realmente importe. Lo demás lo hablamos después.",
      ok: true,
      body: (
        <>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block text-xs font-semibold">Color<input value={d.color} onChange={set("color")} maxLength={60} className={field} /></label>
            <label className="block text-xs font-semibold">Talla<input value={d.size} onChange={set("size")} maxLength={40} className={field} /></label>
          </div>
          <label className="block text-xs font-semibold">Características deseadas<textarea rows={2} value={d.features} onChange={set("features")} maxLength={600} placeholder="Ej.: capacidad de 256 GB, que sea resistente al agua…" className={field} /></label>
        </>
      ),
    },
    {
      q: "¿Tienes un presupuesto aproximado?",
      help: "Nos ayuda a buscarte opciones realistas. Es opcional.",
      ok: true,
      body: (
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block text-xs font-semibold">Presupuesto en COP<input inputMode="numeric" value={d.budget} onChange={set("budget")} maxLength={12} placeholder="Ej.: 3500000" className={field} /></label>
          <label className="block text-xs font-semibold">País o tienda de referencia<input value={d.referenceStore} onChange={set("referenceStore")} maxLength={120} placeholder="Ej.: Amazon EE.UU." className={field} /></label>
        </div>
      ),
    },
    {
      q: "¿Cómo te respondemos?",
      help: "Te escribiremos al correo. El teléfono es opcional y solo para atenderte.",
      ok: d.name.trim().length >= 2 && /\S+@\S+\.\S+/.test(d.email) && consent,
      body: (
        <>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block text-xs font-semibold">Tu nombre *<input value={d.name} onChange={set("name")} maxLength={80} autoComplete="name" className={field} /></label>
            <label className="block text-xs font-semibold">Correo electrónico *<input type="email" value={d.email} onChange={set("email")} maxLength={254} autoComplete="email" className={field} /></label>
          </div>
          <label className="block text-xs font-semibold">Teléfono (opcional)<input type="tel" value={d.phone} onChange={set("phone")} maxLength={20} autoComplete="tel" className={field} /></label>
          <input type="text" tabIndex={-1} autoComplete="off" aria-hidden="true" value={d.website} onChange={set("website")} className="absolute -left-[9999px] h-0 w-0 opacity-0" name="website" />
          <label className="flex items-start gap-3 text-xs leading-5 text-ink-soft">
            <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="mt-0.5 size-4 accent-[#0a0a0a]" />
            <span>Autorizo a 7H STORE a usar mis datos solo para atender esta solicitud, según la <Link href="/privacidad" className="underline">política de privacidad</Link>.</span>
          </label>
        </>
      ),
    },
  ];
  const last = steps.length; // paso de resumen
  const budget = d.budget.replace(/\D/g, "");

  const send = async () => {
    setSending(true);
    setError(undefined);
    const r = await postMultipart("/api/tu-lo-buscas", {
      name: d.name, email: d.email, phone: d.phone, productName: d.productName, comments: d.comments, brand: d.brand, model: d.model, color: d.color, size: d.size,
      features: d.features, referenceStore: d.referenceStore, links: d.links, budgetCOP: budget ? Number(budget) : null, consent, website: d.website, source,
    }, files);
    setSending(false);
    if (!r.ok) return setError(r.error);
    setDone({ code: String(r.data.code), link: (r.data.link as string | null) ?? null, duplicate: !!r.data.duplicate });
  };

  if (done) {
    return (
      <div role="status" className="surface panel-in rounded-[28px] p-8 text-center sm:p-12">
        <span className="mx-auto grid size-14 place-items-center rounded-full bg-ink text-gold-light">
          <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2.4" aria-hidden="true"><path className="draw-check" d="M5 12.5l4.5 4.5L19 7.5" /></svg>
        </span>
        <p className="type-h3 mt-5">{done.duplicate ? "Ya teníamos tu solicitud" : "Solicitud enviada"}</p>
        <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-ink-soft">Tu solicitud fue enviada correctamente a 7H STORE. Nuestro equipo revisará la información y preparará posibles alternativas para ti.</p>
        <p className="mt-3 text-sm">Número de seguimiento: <strong className="font-mono">{done.code}</strong></p>
        <p className="mx-auto mt-2 max-w-md text-xs text-ink-soft">Te escribimos a {d.email}. No prometemos disponibilidad, precio ni fecha hasta confirmarlos.</p>
        {done.link && <Link href={done.link} className="mt-6 inline-flex rounded-full bg-ink px-6 py-3 text-sm font-semibold text-ivory transition-colors hover:bg-gold hover:text-ink">Ver mi solicitud</Link>}
      </div>
    );
  }

  return (
    <div className="surface relative rounded-[28px] p-6 sm:p-9">
      <div className="flex items-center justify-between gap-4">
        <p className="type-eyebrow flex items-center gap-2 text-gold-deep"><span aria-hidden="true" className="size-1.5 rounded-full bg-gold" /> AURA · Asistente</p>
        <p className="text-xs text-ink-soft" aria-live="polite">{step < last ? `Paso ${step + 1} de ${last}` : "Resumen"}</p>
      </div>
      <div aria-hidden="true" className="mt-3 h-1 overflow-hidden rounded-full bg-ink/[.07]"><div className="h-full rounded-full bg-gold transition-[width] duration-500" style={{ width: `${(Math.min(step, last) / last) * 100}%` }} /></div>

      {step < last ? (
        <div key={step} className="panel-in mt-6 space-y-4">
          <div>
            <h2 className="type-h3">{steps[step].q}</h2>
            <p className="mt-1 text-sm text-ink-soft">{steps[step].help}</p>
          </div>
          {steps[step].body}
        </div>
      ) : (
        <div className="panel-in mt-6 space-y-4">
          <h2 className="type-h3">¿Está todo bien?</h2>
          <p className="text-sm text-ink-soft">Revisa tu solicitud antes de enviarla. Puedes volver y cambiar lo que quieras.</p>
          <dl className="grid gap-x-6 gap-y-3 rounded-2xl bg-ivory-200/60 p-5 text-sm sm:grid-cols-2">
            {([["Producto", d.productName], ["Detalles", d.comments], ["Marca", d.brand], ["Modelo", d.model], ["Color", d.color], ["Talla", d.size], ["Características", d.features], ["Presupuesto", budget ? formatCOP(Number(budget)) : ""], ["Tienda de referencia", d.referenceStore], ["Fotos", files.length ? `${files.length}` : ""], ["Enlaces", d.links.length ? `${d.links.length}` : ""], ["Contacto", `${d.name} · ${d.email}${d.phone ? ` · ${d.phone}` : ""}`]] as const).filter(([, v]) => v).map(([k, v]) => (
              <div key={k}><dt className="text-[11px] text-ink-soft">{k}</dt><dd className="break-words">{v}</dd></div>
            ))}
          </dl>
        </div>
      )}

      {error && <p role="alert" className="mt-4 text-sm text-error">{error}</p>}
      <div className="mt-7 flex flex-wrap items-center gap-3">
        {step > 0 && <button type="button" onClick={() => { setError(undefined); setStep((s) => s - 1); }} className="rounded-full border border-ink/20 px-5 py-3 text-sm font-semibold hover:border-gold">Atrás</button>}
        {step < last ? (
          <>
            <button type="button" disabled={!steps[step].ok} onClick={() => { setError(undefined); setStep((s) => s + 1); }} className="btn-shine rounded-full bg-ink px-7 py-3 text-sm font-semibold text-ivory transition-colors hover:bg-gold hover:text-ink disabled:opacity-40">Continuar</button>
            {step > 0 && step < last - 1 && <button type="button" onClick={() => setStep((s) => s + 1)} className="px-2 text-sm text-ink-soft underline-offset-4 hover:underline">No lo sé, sigamos</button>}
          </>
        ) : (
          <button type="button" disabled={sending} onClick={send} className="btn-shine rounded-full bg-ink px-8 py-3.5 text-sm font-semibold text-ivory transition-colors hover:bg-gold hover:text-ink disabled:opacity-60">{sending ? "Enviando…" : "Confirmar y enviar"}</button>
        )}
      </div>
    </div>
  );
}
