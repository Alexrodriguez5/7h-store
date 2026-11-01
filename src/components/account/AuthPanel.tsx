"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { callApi } from "./api";
import { Notice, btnGold, btnLine, fieldCls, labelCls } from "./ui";

type Tab = "codigo" | "clave";
type ClaveMode = "entrar" | "registro" | "olvide";

const AVISOS: Record<string, string> = {
  "enlace-invalido": "El enlace no es válido o ya venció. Pide uno nuevo.",
  "google-no-disponible": "El acceso con Google estará disponible muy pronto. Usa otro método.",
  "google-error": "No pudimos completar el acceso con Google. Inténtalo de nuevo.",
  "google-correo-sin-verificar": "Tu correo de Google no está verificado. Usa otro método.",
  "cuenta-bloqueada": "Esta cuenta está bloqueada. Escríbenos para ayudarte.",
  "demasiados-intentos": "Demasiados intentos. Espera unos minutos.",
};

/** Acceso de clientes: Google, código al correo o correo y contraseña. Un solo perfil por correo. */
export function AuthPanel({ next = "/cuenta/pedidos", aviso, register = false, googleEnabled, otpEnabled }: { next?: string; aviso?: string; register?: boolean; googleEnabled: boolean; otpEnabled: boolean }) {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>(otpEnabled && !register ? "codigo" : "clave");
  const [mode, setMode] = useState<ClaveMode>(register ? "registro" : "entrar");
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [codeSent, setCodeSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ tone: "error" | "success" | "gold"; text: string } | null>(aviso && AVISOS[aviso] ? { tone: "error", text: AVISOS[aviso] } : null);

  const run = async (fn: () => Promise<void>) => {
    if (busy) return;
    setBusy(true);
    setMsg(null);
    await fn();
    setBusy(false);
  };
  const go = () => {
    router.replace(next);
    router.refresh();
  };

  const sendCode = (e?: FormEvent) => {
    e?.preventDefault();
    return run(async () => {
      const r = await callApi("/api/cuenta/codigo/solicitar", "POST", { email });
      if (!r.ok) return setMsg({ tone: "error", text: r.data.error ?? "No pudimos enviar el código." });
      setCodeSent(true);
      setMsg({ tone: "success", text: r.data.message ?? "Te enviamos un código." });
    });
  };
  const verifyCode = (e: FormEvent) => {
    e.preventDefault();
    return run(async () => {
      const r = await callApi("/api/cuenta/codigo/verificar", "POST", { email, code });
      if (!r.ok) return setMsg({ tone: "error", text: r.data.error ?? "Código incorrecto." });
      go();
    });
  };
  const submitClave = (e: FormEvent) => {
    e.preventDefault();
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

  const tabBtn = (t: Tab, label: string) => (
    <button type="button" role="tab" aria-selected={tab === t} onClick={() => { setTab(t); setMsg(null); }} className={`flex-1 rounded-full px-4 py-2.5 text-xs font-semibold transition-colors ${tab === t ? "bg-ink text-ivory" : "text-ink-soft hover:text-ink"}`}>
      {label}
    </button>
  );

  return (
    <div className="space-y-5 rounded-3xl border border-ink/[.07] bg-white/80 p-6 shadow-lift backdrop-blur sm:p-8">
      <a
        href={googleEnabled ? `/api/cuenta/google/iniciar?next=${encodeURIComponent(next)}` : undefined}
        aria-disabled={!googleEnabled}
        onClick={(e) => { if (!googleEnabled) { e.preventDefault(); setMsg({ tone: "gold", text: AVISOS["google-no-disponible"] }); } }}
        className={`${btnLine} w-full py-3.5 ${googleEnabled ? "" : "opacity-60"}`}
      >
        <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path fill="#EA4335" d="M12 10.2v3.9h5.5c-.2 1.3-1.6 3.8-5.5 3.8-3.3 0-6-2.7-6-6.1s2.7-6.1 6-6.1c1.9 0 3.1.8 3.8 1.5l2.6-2.5C16.8 3.2 14.6 2.2 12 2.2 6.6 2.2 2.2 6.6 2.2 12s4.4 9.8 9.8 9.8c5.7 0 9.4-4 9.4-9.6 0-.6-.1-1.1-.2-1.6H12z"/></svg>
        Continuar con Google
      </a>
      <div className="flex items-center gap-3 text-[11px] uppercase tracking-widest text-ink/40"><span className="h-px flex-1 bg-ink/10" />o<span className="h-px flex-1 bg-ink/10" /></div>
      <div role="tablist" className="flex gap-1 rounded-full bg-ink/[.05] p-1">
        {tabBtn("codigo", "Código al correo")}
        {tabBtn("clave", "Correo y contraseña")}
      </div>

      {tab === "codigo" && (
        <form onSubmit={codeSent ? verifyCode : sendCode} className="space-y-4" noValidate>
          <div>
            <label htmlFor="otp-email" className={labelCls}>Correo</label>
            <input id="otp-email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} className={fieldCls} placeholder="tucorreo@ejemplo.com" disabled={codeSent} />
          </div>
          {codeSent && (
            <div className="animate-fade-up">
              <label htmlFor="otp-code" className={labelCls}>Código de 6 dígitos</label>
              <input id="otp-code" inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} className={`${fieldCls} text-center font-mono text-xl tracking-[.5em]`} placeholder="••••••" />
            </div>
          )}
          <button type="submit" disabled={busy || !email || (codeSent && code.length !== 6)} className={`${btnGold} w-full`}>
            {busy ? "Un momento…" : codeSent ? "Entrar" : "Enviarme un código"}
          </button>
          {codeSent && (
            <button type="button" onClick={() => { setCodeSent(false); setCode(""); }} className="w-full text-xs text-ink-soft underline-offset-4 hover:underline">Usar otro correo o reenviar</button>
          )}
          <p className="text-xs leading-5 text-ink-soft">Sin contraseñas: si es tu primera vez, tu cuenta se crea al entrar.</p>
        </form>
      )}

      {tab === "clave" && (
        <form onSubmit={submitClave} className="space-y-4" noValidate>
          {mode === "registro" && (
            <div>
              <label htmlFor="reg-name" className={labelCls}>Nombre completo</label>
              <input id="reg-name" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} className={fieldCls} />
            </div>
          )}
          <div>
            <label htmlFor="pw-email" className={labelCls}>Correo</label>
            <input id="pw-email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} className={fieldCls} placeholder="tucorreo@ejemplo.com" />
          </div>
          {mode !== "olvide" && (
            <div>
              <label htmlFor="pw-pass" className={labelCls}>Contraseña {mode === "registro" && <span className="font-normal text-ink-soft">(mínimo 12 caracteres)</span>}</label>
              <input id="pw-pass" type="password" autoComplete={mode === "registro" ? "new-password" : "current-password"} value={password} onChange={(e) => setPassword(e.target.value)} className={fieldCls} />
            </div>
          )}
          <button type="submit" disabled={busy} className={`${btnGold} w-full`}>
            {busy ? "Un momento…" : mode === "entrar" ? "Iniciar sesión" : mode === "registro" ? "Crear cuenta" : "Enviarme el enlace"}
          </button>
          <div className="flex flex-wrap justify-between gap-2 text-xs">
            {mode !== "entrar" && <button type="button" onClick={() => setMode("entrar")} className="underline-offset-4 hover:underline">Ya tengo cuenta</button>}
            {mode !== "registro" && <button type="button" onClick={() => setMode("registro")} className="underline-offset-4 hover:underline">Crear cuenta</button>}
            {mode !== "olvide" && <button type="button" onClick={() => setMode("olvide")} className="text-ink-soft underline-offset-4 hover:underline">Olvidé mi contraseña</button>}
          </div>
        </form>
      )}

      {msg && <Notice tone={msg.tone}>{msg.text}</Notice>}
      <p className="text-[11px] leading-5 text-ink-soft">
        Al continuar aceptas los <a href="/terminos" className="underline">términos</a> y la <a href="/privacidad" className="underline">política de tratamiento de datos</a>. Verás todos los pedidos hechos con tu correo, también los que hiciste como invitado.
      </p>
    </div>
  );
}
