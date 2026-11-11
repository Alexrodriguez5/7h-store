"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent, type ReactNode } from "react";
import { callApi } from "./api";
import { OtpInput } from "./OtpInput";
import { guardElement } from "@/components/ui/useFieldGuard";
import { MSG, emailField, personName } from "@/lib/validation/fields";

type Tab = "codigo" | "clave";
type ClaveMode = "entrar" | "registro" | "olvide";

const AVISOS: Record<string, string> = {
  "enlace-invalido": "El enlace no es válido o ya venció. Pide uno nuevo.",
  "google-no-disponible": "El acceso con Google estará disponible muy pronto. Usa otro método.",
  "google-error": "No pudimos completar el acceso con Google. Inténtalo de nuevo.",
  "google-correo-sin-verificar": "Tu correo de Google no está verificado. Usa otro método.",
  "google-cancelado": "Cancelaste el inicio de sesión con Google. Puedes intentarlo de nuevo o usar otro método.",
  "cuenta-bloqueada": "Esta cuenta está bloqueada. Escríbenos para ayudarte.",
  "demasiados-intentos": "Demasiados intentos. Espera unos minutos.",
};

/* Estilos del panel de vidrio oscuro (7H AURA) */
const field =
  "w-full rounded-2xl border border-white/10 bg-white/[.05] px-4 py-3.5 text-sm text-ivory outline-none transition-all placeholder:text-ivory/30 hover:border-white/20 focus:border-gold-light focus:bg-white/[.08] focus:shadow-[0_0_0_4px_rgb(201_164_76_/_.16)] disabled:opacity-60";
const label = "mb-1.5 block text-[11px] font-semibold uppercase tracking-[.14em] text-ivory/55";
const primary =
  "btn-shine relative inline-flex w-full items-center justify-center gap-2 rounded-full bg-gradient-to-b from-gold-light to-gold px-6 py-3.5 text-sm font-bold text-ink shadow-[0_10px_30px_-10px_rgb(201_164_76_/_.8)] transition-all hover:-translate-y-0.5 hover:shadow-[0_16px_40px_-12px_rgb(216_184_102_/_.9)] active:translate-y-0 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0";
const linkBtn = "text-xs text-ivory/60 underline-offset-4 transition-colors hover:text-gold-light hover:underline";

function Spinner() {
  return <span aria-hidden="true" className="size-4 animate-spin rounded-full border-2 border-ink/30 border-t-ink" />;
}

function Message({ tone, children }: { tone: "error" | "success" | "gold"; children: ReactNode }) {
  const c = tone === "error" ? "border-red-400/30 bg-red-500/10 text-red-200" : tone === "success" ? "border-emerald-400/30 bg-emerald-500/10 text-emerald-200" : "border-gold/30 bg-gold/10 text-gold-light";
  return <div role={tone === "error" ? "alert" : "status"} className={`panel-in rounded-2xl border px-4 py-3 text-sm leading-6 ${c}`}>{children}</div>;
}

/**
 * Acceso de clientes (Google, código al correo o correo y contraseña): un solo perfil por correo.
 * Diseño 7H AURA: panel de vidrio oscuro con borde dorado luminoso. La lógica y las APIs no cambian.
 */
export function AuthPanel({ next = "/cuenta/pedidos", aviso, register = false, googleEnabled, otpEnabled }: { next?: string; aviso?: string; register?: boolean; googleEnabled: boolean; otpEnabled: boolean }) {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>(otpEnabled && !register ? "codigo" : "clave");
  const [mode, setMode] = useState<ClaveMode>(register ? "registro" : "entrar");
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [code, setCode] = useState("");
  const [codeSent, setCodeSent] = useState(false);
  const [codeError, setCodeError] = useState(0);
  const [success, setSuccess] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ tone: "error" | "success" | "gold"; text: string } | null>(aviso && AVISOS[aviso] ? { tone: "error", text: AVISOS[aviso] } : null);

  const run = async (fn: () => Promise<void>) => {
    if (busy) return;
    setBusy(true);
    setMsg(null);
    await fn();
    setBusy(false);
  };
  /** Éxito: breve confirmación visual y luego a la cuenta. */
  const go = () => {
    setSuccess(true);
    window.setTimeout(() => { router.replace(next); router.refresh(); }, 750);
  };

  /** El correo no lleva espacios (el autocompletado a veces agrega uno al final): se quitan al escribir o pegar. */
  const onEmail = (e: React.ChangeEvent<HTMLInputElement>) => { guardElement("email", e.currentTarget); setEmail(e.currentTarget.value); };
  /** Revisa el correo (y el nombre al registrarse) con las mismas reglas del servidor antes de enviar. */
  const invalid = (withName = false) => {
    const m = !emailField.safeParse(email).success ? MSG.email : withName ? personName(3, 120, "Escribe tu nombre completo").safeParse(name).error?.issues[0]?.message : undefined;
    if (m) setMsg({ tone: "error", text: m });
    return !!m;
  };
  const sendCode = (e?: FormEvent) => {
    e?.preventDefault();
    if (invalid()) return;
    return run(async () => {
      const r = await callApi("/api/cuenta/codigo/solicitar", "POST", { email });
      if (!r.ok) return setMsg({ tone: "error", text: r.data.error ?? "No pudimos enviar el código." });
      setCodeSent(true);
      setCode("");
      setMsg({ tone: "success", text: r.data.message ?? "Te enviamos un código." });
    });
  };
  const verifyCode = (e?: FormEvent) => {
    e?.preventDefault();
    return run(async () => {
      const r = await callApi("/api/cuenta/codigo/verificar", "POST", { email, code });
      if (!r.ok) { setCodeError((n) => n + 1); return setMsg({ tone: "error", text: r.data.error ?? "Código incorrecto." }); }
      go();
    });
  };
  const submitClave = (e: FormEvent) => {
    e.preventDefault();
    if (invalid(mode === "registro")) return;
    if (mode === "registro" && password !== confirm) return setMsg({ tone: "error", text: "Las contraseñas no coinciden." });
    return run(async () => {
      if (mode === "entrar") {
        const r = await callApi("/api/cuenta/ingresar", "POST", { email, password });
        if (!r.ok) return setMsg({ tone: "error", text: r.data.error ?? "No pudimos iniciar sesión." });
        return go();
      }
      if (mode === "registro") {
        const r = await callApi("/api/cuenta/registro", "POST", { name, email, password });
        return setMsg(r.ok ? { tone: "success", text: r.data.message ?? "Revisa tu correo." } : { tone: "error", text: r.data.error ?? "No pudimos crear la cuenta." });
      }
      const r = await callApi("/api/cuenta/olvide", "POST", { email });
      setMsg(r.ok ? { tone: "success", text: r.data.message ?? "Revisa tu correo." } : { tone: "error", text: r.data.error ?? "Inténtalo de nuevo." });
    });
  };

  const switchTab = (t: Tab) => { setTab(t); setMsg(null); };
  const switchMode = (m: ClaveMode) => { setMode(m); setMsg(null); };
  const title = tab === "codigo" ? (codeSent ? "Verifica tu código" : "Bienvenido") : mode === "entrar" ? "Inicia sesión" : mode === "registro" ? "Crea tu cuenta" : "Recupera tu acceso";
  const subtitle = tab === "codigo"
    ? codeSent ? <>Escribe los 6 dígitos que enviamos a <span className="text-ivory">{email}</span>.</> : "Te enviamos un código de 6 dígitos. Sin contraseñas."
    : mode === "olvide" ? "Te enviaremos un enlace para crear una nueva contraseña." : "Tus pedidos, envíos y garantías en un solo lugar.";

  return (
    <div className="glass-dark aura-ring relative overflow-hidden rounded-[32px] p-6 text-ivory sm:p-9">
      {/* Reflejo dinámico superior */}
      <div aria-hidden="true" className="pointer-events-none absolute -top-24 left-1/2 h-48 w-[120%] -translate-x-1/2 rounded-[50%] bg-gradient-to-b from-white/10 to-transparent blur-2xl" />

      {success ? (
        <div className="panel-in flex flex-col items-center py-10 text-center" role="status">
          <span className="grid size-20 place-items-center rounded-full bg-gold/15 shadow-[0_0_50px_-6px_rgb(216_184_102_/_.8)]">
            <svg viewBox="0 0 24 24" width="40" height="40" fill="none" stroke="#d8b866" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path className="draw-check" d="M5 12.5l4.5 4.5L19 7.5" /></svg>
          </span>
          <p className="mt-6 font-display text-3xl">¡Listo!</p>
          <p className="mt-1 text-sm text-ivory/60">Entrando a tu cuenta…</p>
        </div>
      ) : (
        <div className="relative space-y-6">
          <div key={`${tab}-${mode}-${codeSent}`} className="panel-in">
            <p className="text-[10px] font-semibold uppercase tracking-[.32em] text-gold-light">Mi cuenta 7H</p>
            <h2 className="mt-2 type-h2">{title}</h2>
            <p className="mt-2 text-sm leading-6 text-ivory/60">{subtitle}</p>
          </div>

          {!codeSent && (
            <>
              <a
                href={googleEnabled ? `/api/cuenta/google/iniciar?next=${encodeURIComponent(next)}` : undefined}
                aria-disabled={!googleEnabled}
                onClick={(e) => { if (!googleEnabled) { e.preventDefault(); setMsg({ tone: "gold", text: AVISOS["google-no-disponible"] }); } }}
                className={`flex w-full items-center justify-center gap-3 rounded-full border border-white/15 bg-white/[.06] px-5 py-3.5 text-sm font-semibold text-ivory transition-all hover:border-white/30 hover:bg-white/[.1] ${googleEnabled ? "" : "opacity-50"}`}
              >
                <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path fill="#EA4335" d="M12 10.2v3.9h5.5c-.2 1.3-1.6 3.8-5.5 3.8-3.3 0-6-2.7-6-6.1s2.7-6.1 6-6.1c1.9 0 3.1.8 3.8 1.5l2.6-2.5C16.8 3.2 14.6 2.2 12 2.2 6.6 2.2 2.2 6.6 2.2 12s4.4 9.8 9.8 9.8c5.7 0 9.4-4 9.4-9.6 0-.6-.1-1.1-.2-1.6H12z"/></svg>
                Continuar con Google
              </a>
              <div className="flex items-center gap-3 text-[10px] uppercase tracking-[.3em] text-ivory/35"><span className="h-px flex-1 bg-white/10" />o<span className="h-px flex-1 bg-white/10" /></div>
              <div role="tablist" aria-label="Forma de acceso" className="relative grid grid-cols-2 rounded-full border border-white/10 bg-white/[.04] p-1">
                <span aria-hidden="true" className={`absolute inset-y-1 w-[calc(50%-4px)] rounded-full bg-ivory shadow transition-transform duration-300 ease-out ${tab === "clave" ? "translate-x-[calc(100%+4px)]" : "translate-x-0"}`} style={{ left: 4 }} />
                {(["codigo", "clave"] as const).map((t) => (
                  <button key={t} type="button" role="tab" aria-selected={tab === t} onClick={() => switchTab(t)} className={`relative z-10 rounded-full px-3 py-2.5 text-xs font-bold transition-colors ${tab === t ? "text-ink" : "text-ivory/60 hover:text-ivory"}`}>
                    {t === "codigo" ? "Código al correo" : "Correo y contraseña"}
                  </button>
                ))}
              </div>
            </>
          )}

          {tab === "codigo" && (
            <form key={`otp-${codeSent}`} onSubmit={codeSent ? verifyCode : sendCode} className="panel-in space-y-5" noValidate>
              {!codeSent ? (
                <div>
                  <label htmlFor="otp-email" className={label}>Correo</label>
                  <input id="otp-email" type="email" inputMode="email" autoComplete="email" spellCheck={false} maxLength={254} required value={email} onChange={onEmail} className={field} placeholder="tucorreo@ejemplo.com" />
                </div>
              ) : (
                <OtpInput key={codeError} value={code} onChange={(v) => { setCode(v); if (msg?.tone === "error") setMsg(null); }} error={codeError > 0 && msg?.tone === "error"} disabled={busy} />
              )}
              <button type="submit" disabled={busy || !email || (codeSent && code.length !== 6)} className={primary}>
                {busy ? <><Spinner /> Un momento…</> : codeSent ? "Verificar y entrar" : "Enviarme un código"}
              </button>
              {codeSent && (
                <div className="flex flex-wrap justify-between gap-2">
                  <button type="button" onClick={() => { setCodeSent(false); setCode(""); setMsg(null); }} className={linkBtn}>← Usar otro correo</button>
                  <button type="button" onClick={() => sendCode()} disabled={busy} className={linkBtn}>Reenviar código</button>
                </div>
              )}
            </form>
          )}

          {tab === "clave" && (
            <form key={`clave-${mode}`} onSubmit={submitClave} className="panel-in space-y-4" noValidate>
              {mode === "registro" && (
                <div>
                  <label htmlFor="reg-name" className={label}>Nombre completo</label>
                  <input id="reg-name" autoComplete="name" maxLength={120} value={name} onChange={(e) => { const r = guardElement("name", e.currentTarget); if (r) setMsg({ tone: "error", text: r }); setName(e.currentTarget.value); }} className={field} />
                </div>
              )}
              <div>
                <label htmlFor="pw-email" className={label}>Correo</label>
                <input id="pw-email" type="email" inputMode="email" autoComplete="email" spellCheck={false} maxLength={254} value={email} onChange={onEmail} className={field} placeholder="tucorreo@ejemplo.com" />
              </div>
              {mode !== "olvide" && (
                <div>
                  <label htmlFor="pw-pass" className={label}>Contraseña {mode === "registro" && <span className="normal-case tracking-normal text-ivory/40">(mínimo 12 caracteres)</span>}</label>
                  <input id="pw-pass" type="password" autoComplete={mode === "registro" ? "new-password" : "current-password"} value={password} onChange={(e) => setPassword(e.target.value)} className={field} />
                </div>
              )}
              {mode === "registro" && (
                <div>
                  <label htmlFor="pw-confirm" className={label}>Confirma la contraseña</label>
                  <input id="pw-confirm" type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} aria-invalid={!!confirm && confirm !== password} className={field} />
                </div>
              )}
              <button type="submit" disabled={busy} className={primary}>
                {busy ? <><Spinner /> Un momento…</> : mode === "entrar" ? "Iniciar sesión" : mode === "registro" ? "Crear cuenta" : "Enviarme el enlace"}
              </button>
              <div className="flex flex-wrap justify-between gap-2">
                {mode !== "entrar" && <button type="button" onClick={() => switchMode("entrar")} className={linkBtn}>Ya tengo cuenta</button>}
                {mode !== "registro" && <button type="button" onClick={() => switchMode("registro")} className={linkBtn}>Crear cuenta</button>}
                {mode !== "olvide" && <button type="button" onClick={() => switchMode("olvide")} className={linkBtn}>Olvidé mi contraseña</button>}
              </div>
            </form>
          )}

          {msg && <Message tone={msg.tone}>{msg.text}</Message>}
          <p className="text-[11px] leading-5 text-ivory/40">
            Al continuar aceptas los <a href="/terminos" className="underline hover:text-gold-light">términos</a> y la <a href="/privacidad" className="underline hover:text-gold-light">política de tratamiento de datos</a>. Verás todos los pedidos hechos con tu correo, también los que hiciste como invitado.
          </p>
        </div>
      )}
    </div>
  );
}
