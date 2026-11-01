"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { callApi } from "./api";
import { Notice, btnGold, fieldCls, labelCls } from "./ui";

export function ResetPasswordForm({ email, token }: { email: string; token: string }) {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string>();

  if (!email || !token) return <Notice tone="error">El enlace está incompleto. Pide uno nuevo desde «Olvidé mi contraseña».</Notice>;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (password !== confirm) return setErr("Las contraseñas no coinciden.");
    setBusy(true);
    setErr(undefined);
    const r = await callApi("/api/cuenta/restablecer", "POST", { email, token, password });
    setBusy(false);
    if (!r.ok) return setErr(r.data.error ?? "No pudimos guardar la contraseña.");
    router.replace("/cuenta/pedidos");
    router.refresh();
  };

  return (
    <form onSubmit={submit} className="space-y-4 rounded-3xl border border-ink/[.07] bg-white/80 p-6 shadow-soft">
      <div><label htmlFor="np" className={labelCls}>Nueva contraseña</label><input id="np" type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} className={fieldCls} /></div>
      <div><label htmlFor="np2" className={labelCls}>Repítela</label><input id="np2" type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} className={fieldCls} /></div>
      <button type="submit" disabled={busy} className={`${btnGold} w-full`}>{busy ? "Guardando…" : "Guardar y entrar"}</button>
      {err && <Notice tone="error">{err}</Notice>}
    </form>
  );
}
