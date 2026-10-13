"use client";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { adminFetch } from "./api";
import { btnPrimary, inputCls, labelCls } from "./ui";

export function SetupForm() {
  const router = useRouter();
  const [v, setV] = useState({ setupKey: "", name: "", email: "", password: "", confirm: "" });
  const [error, setError] = useState<string>();
  const [loading, setLoading] = useState(false);
  const set = (k: keyof typeof v) => (e: React.ChangeEvent<HTMLInputElement>) => setV((p) => ({ ...p, [k]: e.target.value }));

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (loading) return;
    if (v.password.length < 12) return setError("La contraseña debe tener al menos 12 caracteres.");
    if (v.password !== v.confirm) return setError("Las contraseñas no coinciden.");
    setLoading(true);
    setError(undefined);
    const r = await adminFetch("/api/admin/setup", "POST", { setupKey: v.setupKey, name: v.name, email: v.email, password: v.password });
    setLoading(false);
    if (!r.ok) return setError(r.error);
    router.replace("/admin");
    router.refresh();
  };

  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      <div>
        <label htmlFor="setupKey" className={labelCls}>Llave de arranque</label>
        <input id="setupKey" type="password" autoComplete="off" required value={v.setupKey} onChange={set("setupKey")} className={inputCls} aria-describedby="setupKey-help" />
        <p id="setupKey-help" className="mt-1 text-[11px] text-ink-soft">Es el valor de <code>ADMIN_PASSWORD</code> en tu archivo <code>.env.local</code>.</p>
      </div>
      <div><label htmlFor="name" className={labelCls}>Tu nombre</label><input id="name" autoComplete="name" required value={v.name} onChange={set("name")} className={inputCls} /></div>
      <div><label htmlFor="email" className={labelCls}>Correo</label><input id="email" type="email" autoComplete="username" required value={v.email} onChange={set("email")} className={inputCls} /></div>
      <div>
        <label htmlFor="password" className={labelCls}>Nueva contraseña</label>
        <input id="password" type="password" autoComplete="new-password" required minLength={12} value={v.password} onChange={set("password")} className={inputCls} aria-describedby="pw-help" />
        <p id="pw-help" className="mt-1 text-[11px] text-ink-soft">Mínimo 12 caracteres. Usa una frase que no uses en otro sitio.</p>
      </div>
      <div><label htmlFor="confirm" className={labelCls}>Repite la contraseña</label><input id="confirm" type="password" autoComplete="new-password" required value={v.confirm} onChange={set("confirm")} className={inputCls} /></div>
      {error && <p role="alert" className="text-xs text-error">{error}</p>}
      <button type="submit" disabled={loading} aria-busy={loading} className={`${btnPrimary} w-full`}>{loading ? "Creando cuenta…" : "Crear cuenta del dueño"}</button>
    </form>
  );
}
