"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { callApi } from "./api";
import { Notice, btnDark, btnLine, fieldCls, labelCls } from "./ui";

type Msg = { tone: "error" | "success"; text: string } | undefined;

export function ProfileForm({ name: n0, phone: p0 }: { name: string; phone: string }) {
  const router = useRouter();
  const [name, setName] = useState(n0);
  const [phone, setPhone] = useState(p0);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<Msg>();
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setMsg(undefined);
    const r = await callApi("/api/cuenta/perfil", "PATCH", { name, phone });
    setBusy(false);
    if (!r.ok) return setMsg({ tone: "error", text: r.data.error ?? "No pudimos guardar." });
    setMsg({ tone: "success", text: "Datos guardados." });
    router.refresh();
  };
  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      <div><label htmlFor="p-name" className={labelCls}>Nombre completo</label><input id="p-name" autoComplete="name" maxLength={120} value={name} onChange={(e) => setName(e.target.value)} className={fieldCls} /></div>
      <div><label htmlFor="p-phone" className={labelCls}>Celular</label><input id="p-phone" inputMode="tel" autoComplete="tel-national" value={phone} onChange={(e) => setPhone(e.target.value.replace(/\D/g, "").slice(0, 10))} className={fieldCls} placeholder="3001234567" /></div>
      <button type="submit" disabled={busy} className={btnDark}>{busy ? "Guardando…" : "Guardar cambios"}</button>
      {msg && <Notice tone={msg.tone}>{msg.text}</Notice>}
    </form>
  );
}

export function PasswordForm({ hasPassword }: { hasPassword: boolean }) {
  const router = useRouter();
  const [current, setCurrent] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<Msg>();
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (password !== confirm) return setMsg({ tone: "error", text: "Las contraseñas no coinciden." });
    setBusy(true);
    setMsg(undefined);
    const r = await callApi("/api/cuenta/clave", "POST", { current: hasPassword ? current : undefined, password });
    setBusy(false);
    if (!r.ok) return setMsg({ tone: "error", text: r.data.error ?? "No pudimos guardar la contraseña." });
    setCurrent(""); setPassword(""); setConfirm("");
    setMsg({ tone: "success", text: "Contraseña guardada. Cerramos tus otras sesiones por seguridad." });
    router.refresh();
  };
  return (
    <form onSubmit={submit} className="space-y-3" noValidate>
      {hasPassword && <div><label htmlFor="pw-cur" className={labelCls}>Contraseña actual</label><input id="pw-cur" type="password" autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} className={fieldCls} /></div>}
      <div><label htmlFor="pw-new" className={labelCls}>Nueva contraseña</label><input id="pw-new" type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} className={fieldCls} /></div>
      <div><label htmlFor="pw-conf" className={labelCls}>Repite la contraseña</label><input id="pw-conf" type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} className={fieldCls} /></div>
      <p className="text-xs text-ink-soft">Mínimo 12 caracteres. Evita usar tu correo o contraseñas que uses en otros sitios.</p>
      <button type="submit" disabled={busy || !password} className={btnLine}>{busy ? "Guardando…" : hasPassword ? "Cambiar contraseña" : "Crear contraseña"}</button>
      {msg && <Notice tone={msg.tone}>{msg.text}</Notice>}
    </form>
  );
}

export function PrivacyRequestForm() {
  const router = useRouter();
  const [kind, setKind] = useState<"actualizar" | "suprimir">("actualizar");
  const [details, setDetails] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<Msg>();
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (kind === "suprimir" && !confirm("¿Seguro que quieres pedir la supresión de tus datos? El equipo la revisará antes de aplicarla.")) return;
    setBusy(true);
    setMsg(undefined);
    const r = await callApi("/api/cuenta/supresion", "POST", { kind, details });
    setBusy(false);
    if (!r.ok) return setMsg({ tone: "error", text: r.data.error ?? "No pudimos enviar la solicitud." });
    setDetails("");
    setMsg({ tone: "success", text: "Recibimos tu solicitud. Te responderemos al correo en máximo 15 días hábiles." });
    router.refresh();
  };
  return (
    <form onSubmit={submit} className="space-y-3" noValidate>
      <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Tipo de solicitud">
        {(["actualizar", "suprimir"] as const).map((k) => (
          <button key={k} type="button" role="radio" aria-checked={kind === k} onClick={() => setKind(k)} className={`rounded-full border px-4 py-2 text-xs font-semibold transition-colors ${kind === k ? "border-gold bg-gold/15" : "border-ink/15 hover:border-ink/30"}`}>
            {k === "actualizar" ? "Actualizar o corregir datos" : "Suprimir mis datos"}
          </button>
        ))}
      </div>
      <label htmlFor="priv-d" className="sr-only">Detalle</label>
      <textarea id="priv-d" rows={3} maxLength={2000} value={details} onChange={(e) => setDetails(e.target.value)} className={fieldCls} placeholder={kind === "actualizar" ? "¿Qué dato quieres actualizar o corregir?" : "Cuéntanos brevemente el motivo (mínimo 10 caracteres)."} />
      <button type="submit" disabled={busy || details.trim().length < 10} className={btnLine}>{busy ? "Enviando…" : "Enviar solicitud"}</button>
      {msg && <Notice tone={msg.tone}>{msg.text}</Notice>}
    </form>
  );
}
