"use client";
import Link from "next/link";
import { useState, type FormEvent } from "react";
import { adminFetch } from "./api";
import { btnPrimary, inputCls, labelCls } from "./ui";

export function RequestResetForm() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string }>();
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (loading) return;
    setLoading(true);
    const r = await adminFetch<{ message?: string }>("/api/admin/password-reset/request", "POST", { email });
    setLoading(false);
    setMsg(r.ok ? { ok: true, text: r.data.message ?? "Revisa tu correo." } : { ok: false, text: r.error ?? "No se pudo enviar." });
  };
  if (msg?.ok) return <p role="status" className="text-sm leading-6">{msg.text}</p>;
  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      <div><label htmlFor="email" className={labelCls}>Correo de tu cuenta</label><input id="email" type="email" autoComplete="username" required autoFocus value={email} onChange={(e) => setEmail(e.target.value)} className={inputCls} /></div>
      {msg && <p role="alert" className="text-xs text-error">{msg.text}</p>}
      <button type="submit" disabled={loading || !email} aria-busy={loading} className={`${btnPrimary} w-full`}>{loading ? "Enviando…" : "Enviar enlace"}</button>
    </form>
  );
}

export function ConfirmResetForm({ token }: { token: string }) {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string>();
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (loading) return;
    if (password.length < 12) return setError("La contraseña debe tener al menos 12 caracteres.");
    if (password !== confirm) return setError("Las contraseñas no coinciden.");
    setLoading(true);
    setError(undefined);
    const r = await adminFetch("/api/admin/password-reset/confirm", "POST", { token, password });
    setLoading(false);
    if (!r.ok) return setError(r.error);
    setDone(true);
  };
  if (done) {
    return (
      <div role="status" className="space-y-4 text-sm leading-6">
        <p>Listo. Tu contraseña se cambió y se cerraron todas tus sesiones abiertas.</p>
        <Link href="/admin/login" className={`${btnPrimary} w-full`}>Iniciar sesión</Link>
      </div>
    );
  }
  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      <div><label htmlFor="password" className={labelCls}>Nueva contraseña</label><input id="password" type="password" autoComplete="new-password" required minLength={12} value={password} onChange={(e) => setPassword(e.target.value)} className={inputCls} /></div>
      <div><label htmlFor="confirm" className={labelCls}>Repite la contraseña</label><input id="confirm" type="password" autoComplete="new-password" required value={confirm} onChange={(e) => setConfirm(e.target.value)} className={inputCls} /></div>
      {error && <p role="alert" className="text-xs text-error">{error}</p>}
      <button type="submit" disabled={loading} aria-busy={loading} className={`${btnPrimary} w-full`}>{loading ? "Guardando…" : "Cambiar contraseña"}</button>
    </form>
  );
}
