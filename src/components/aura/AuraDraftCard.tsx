"use client";

import Link from "next/link";
import { useState } from "react";
import { formatCOP } from "@/lib/format";
import type { RequestDraft } from "@/lib/aura/tools";

const PENDING_LABEL: Record<string, string> = {
  marca: "Marca", modelo: "Modelo o referencia", talla: "Talla", color: "Color", caracteristicas: "Características",
  presupuesto: "Presupuesto", tienda_referencia: "Tienda de referencia", referencia_visual: "Foto o enlace de referencia",
};
const input = "mt-1 w-full rounded-lg border border-white/15 bg-white/[.04] px-3 py-2 text-sm text-ivory outline-none placeholder:text-ivory/35 focus:border-gold";

async function post(url: string, body: unknown) {
  const r = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const data = await r.json().catch(() => ({}));
  return { ok: r.ok, data: data as Record<string, unknown> };
}

/**
 * Tarjeta de confirmación de una búsqueda personalizada. AURA solo PREPARA el borrador: la solicitud se crea
 * aquí, cuando el cliente revisa, corrige y confirma. Si no tiene sesión, verifica su correo con el código
 * que ya usa Mi cuenta; el correo nunca pasa por el chat ni por el modelo.
 */
export function AuraDraftCard({ draft, conversationId, files, links, signedIn, onCreated }: {
  draft: RequestDraft; conversationId: string; files: File[]; links: string[]; signedIn: boolean;
  onCreated: (r: { code: string; link: string | null }) => void;
}) {
  const [d, setD] = useState(draft);
  const [edit, setEdit] = useState(false);
  const [consent, setConsent] = useState(false);
  const [step, setStep] = useState<"review" | "email" | "code">("review");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const set = (k: keyof RequestDraft) => (e: { target: { value: string } }) => setD((p) => ({ ...p, [k]: k === "presupuesto_cop" ? (e.target.value.replace(/\D/g, "") ? Number(e.target.value.replace(/\D/g, "")) : null) : e.target.value || null }));

  const create = async () => {
    setBusy(true);
    setError(undefined);
    const fd = new FormData();
    fd.set("data", JSON.stringify({ conversationId, draft: { ...d, producto: d.producto || draft.producto }, links, consent }));
    files.forEach((f) => fd.append("files", f));
    const r = await fetch("/api/aura/solicitud", { method: "POST", body: fd });
    const data = (await r.json().catch(() => ({}))) as Record<string, unknown>;
    setBusy(false);
    if (r.status === 401 && data.needsVerification) return setStep("email");
    if (!r.ok) return setError(String(data.error ?? "No pudimos registrar la solicitud."));
    onCreated({ code: String(data.code), link: (data.link as string | null) ?? null });
  };

  const sendCode = async () => {
    setBusy(true); setError(undefined);
    const r = await post("/api/cuenta/codigo/solicitar", { email });
    setBusy(false);
    if (!r.ok) return setError(String(r.data.error ?? "No pudimos enviar el código."));
    setStep("code");
  };
  const verify = async () => {
    setBusy(true); setError(undefined);
    const r = await post("/api/cuenta/codigo/verificar", { email, code });
    setBusy(false);
    if (!r.ok) return setError(String(r.data.error ?? "Código incorrecto."));
    await create();
  };

  const rows: [string, string | null][] = [
    ["Producto", d.producto], ["Marca", d.marca], ["Modelo", d.modelo], ["Talla", d.talla], ["Color", d.color],
    ["Presupuesto", d.presupuesto_cop != null ? formatCOP(d.presupuesto_cop) : null], ["Características", d.caracteristicas],
  ];

  return (
    <div className="rounded-2xl border border-gold/30 bg-white/[.03] p-4 text-sm">
      <p className="text-[11px] font-semibold uppercase tracking-[.16em] text-gold-light">Revisa tu solicitud</p>
      {step === "review" && (
        <>
          {edit ? (
            <div className="mt-3 grid gap-2">
              <label className="text-xs text-ivory/70">Producto<input className={input} value={d.producto} onChange={set("producto")} maxLength={160} /></label>
              <div className="grid grid-cols-2 gap-2">
                <label className="text-xs text-ivory/70">Marca<input className={input} value={d.marca ?? ""} onChange={set("marca")} maxLength={60} /></label>
                <label className="text-xs text-ivory/70">Modelo<input className={input} value={d.modelo ?? ""} onChange={set("modelo")} maxLength={80} /></label>
                <label className="text-xs text-ivory/70">Talla<input className={input} value={d.talla ?? ""} onChange={set("talla")} maxLength={40} /></label>
                <label className="text-xs text-ivory/70">Color<input className={input} value={d.color ?? ""} onChange={set("color")} maxLength={60} /></label>
              </div>
              <label className="text-xs text-ivory/70">Presupuesto (COP)<input className={input} inputMode="numeric" value={d.presupuesto_cop ?? ""} onChange={set("presupuesto_cop")} /></label>
            </div>
          ) : (
            <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5">
              {rows.map(([k, v]) => (
                <div key={k} className="contents">
                  <dt className="text-ivory/55">{k}</dt>
                  <dd className={v ? "text-ivory" : "text-ivory/40 italic"}>{v ?? "Pendiente"}</dd>
                </div>
              ))}
            </dl>
          )}
          <p className="mt-3 rounded-lg bg-white/[.04] p-2.5 text-xs leading-5 text-ivory/75">{d.resumen}</p>
          {d.pendientes.length > 0 && <p className="mt-2 text-xs text-ivory/55">Pendiente: {d.pendientes.map((p) => PENDING_LABEL[p] ?? p).join(", ")}. El equipo te lo puede preguntar.</p>}
          <p className="mt-2 text-xs text-ivory/55">Adjuntos: {files.length} foto(s) · {links.length} enlace(s). Se guardan de forma privada para el equipo.</p>
          <label className="mt-3 flex items-start gap-2 text-xs leading-5 text-ivory/70">
            <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="mt-0.5 size-4 accent-[#c9a44c]" />
            <span>Autorizo a 7H STORE a usar mis datos solo para atender esta solicitud (<Link href="/privacidad" className="underline">política de privacidad</Link>).</span>
          </label>
          <div className="mt-3 flex flex-wrap gap-2">
            <button type="button" disabled={!consent || busy} onClick={create} className="min-h-11 rounded-full bg-gold px-5 text-sm font-semibold text-ink transition-colors hover:bg-gold-light disabled:opacity-40">{busy ? "Enviando…" : "Confirmar y enviar"}</button>
            <button type="button" onClick={() => setEdit((v) => !v)} className="min-h-11 rounded-full border border-white/20 px-4 text-sm text-ivory hover:border-gold">{edit ? "Listo" : "Corregir"}</button>
          </div>
        </>
      )}
      {step === "email" && (
        <div className="mt-3 space-y-2">
          <p className="text-xs leading-5 text-ivory/75">{signedIn ? "Verifica tu correo para registrar la solicitud." : "Para registrarla y avisarte, escribe tu correo. Te enviaremos un código de 6 dígitos (así también creas o abres tu cuenta)."} Este correo no pasa por el chat.</p>
          <input className={input} type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="tu@correo.com" aria-label="Correo electrónico" />
          <button type="button" disabled={busy || !/\S+@\S+\.\S+/.test(email)} onClick={sendCode} className="min-h-11 rounded-full bg-gold px-5 text-sm font-semibold text-ink disabled:opacity-40">{busy ? "Enviando…" : "Enviarme el código"}</button>
        </div>
      )}
      {step === "code" && (
        <div className="mt-3 space-y-2">
          <p className="text-xs text-ivory/75">Escribe el código que llegó a {email}.</p>
          <input className={`${input} tracking-[.4em]`} inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} aria-label="Código de 6 dígitos" />
          <button type="button" disabled={busy || code.length !== 6} onClick={verify} className="min-h-11 rounded-full bg-gold px-5 text-sm font-semibold text-ink disabled:opacity-40">{busy ? "Verificando…" : "Verificar y enviar"}</button>
        </div>
      )}
      {error && <p role="alert" className="mt-2 text-xs text-[#f3a7a7]">{error}</p>}
    </div>
  );
}
