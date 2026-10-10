"use client";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { adminFetch } from "./api";
import { btnPrimary, inputCls, labelCls } from "./ui";

export function LoginForm() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string>();
  const [loading, setLoading] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(undefined);
    const r = await adminFetch("/api/admin/login", "POST", { password });
    setLoading(false);
    if (!r.ok) return setError(r.error);
    router.replace("/admin");
    router.refresh();
  };

  return (
    <form onSubmit={submit} className="space-y-5">
      <div>
        <label htmlFor="password" className={labelCls}>Contraseña</label>
        <input id="password" type="password" autoComplete="current-password" required autoFocus value={password} onChange={(e) => setPassword(e.target.value)} className={inputCls} />
      </div>
      {error && <p role="alert" className="text-xs text-error">{error}</p>}
      <button type="submit" disabled={loading || !password} className={`${btnPrimary} w-full`}>{loading ? "Verificando…" : "Ingresar"}</button>
    </form>
  );
}
