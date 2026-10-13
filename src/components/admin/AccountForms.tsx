"use client";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { adminFetch } from "./api";
import { btnDanger, btnPrimary, inputCls, labelCls } from "./ui";

export function ChangePasswordForm() {
  const [v, setV] = useState({ currentPassword: "", newPassword: "", confirm: "" });
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string }>();
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (busy) return;
    if (v.newPassword.length < 12) return setMsg({ ok: false, text: "La nueva contraseña debe tener al menos 12 caracteres." });
    if (v.newPassword !== v.confirm) return setMsg({ ok: false, text: "Las contraseñas no coinciden." });
    setBusy(true);
    setMsg(undefined);
    const r = await adminFetch("/api/admin/account/password", "POST", { currentPassword: v.currentPassword, newPassword: v.newPassword });
    setBusy(false);
    if (!r.ok) return setMsg({ ok: false, text: r.error ?? "Error" });
    setV({ currentPassword: "", newPassword: "", confirm: "" });
    setMsg({ ok: true, text: "Contraseña cambiada. Se cerraron tus sesiones en otros dispositivos." });
  };
  return (
    <form onSubmit={submit} className="max-w-sm space-y-4" noValidate>
      <div><label htmlFor="cur" className={labelCls}>Contraseña actual</label><input id="cur" type="password" autoComplete="current-password" required value={v.currentPassword} onChange={(e) => setV({ ...v, currentPassword: e.target.value })} className={inputCls} /></div>
      <div><label htmlFor="new" className={labelCls}>Nueva contraseña (12+)</label><input id="new" type="password" autoComplete="new-password" required minLength={12} value={v.newPassword} onChange={(e) => setV({ ...v, newPassword: e.target.value })} className={inputCls} /></div>
      <div><label htmlFor="conf" className={labelCls}>Repite la nueva contraseña</label><input id="conf" type="password" autoComplete="new-password" required value={v.confirm} onChange={(e) => setV({ ...v, confirm: e.target.value })} className={inputCls} /></div>
      {msg && <p role={msg.ok ? "status" : "alert"} className={`text-xs ${msg.ok ? "text-success" : "text-error"}`}>{msg.text}</p>}
      <button type="submit" disabled={busy || !v.currentPassword} aria-busy={busy} className={btnPrimary}>{busy ? "Guardando…" : "Cambiar contraseña"}</button>
    </form>
  );
}

export function LogoutAllButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const run = async () => {
    if (!window.confirm("¿Cerrar tu sesión en todos los dispositivos, incluido este?")) return;
    setBusy(true);
    await adminFetch("/api/admin/account/logout-all", "POST");
    router.replace("/admin/login");
    router.refresh();
  };
  return <button type="button" disabled={busy} onClick={run} className={btnDanger}>{busy ? "Cerrando…" : "Cerrar sesión en todos los dispositivos"}</button>;
}
