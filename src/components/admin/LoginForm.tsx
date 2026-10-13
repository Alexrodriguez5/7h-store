"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { adminFetch } from "./api";
import { btnPrimary, inputCls, labelCls } from "./ui";

export function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string>();
  const [needsSetup, setNeedsSetup] = useState(false);
  const [loading, setLoading] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (loading) return;
    setLoading(true);
    setError(undefined);
    const r = await adminFetch<{ setup?: boolean }>("/api/admin/login", "POST", { email, password });
    setLoading(false);
    if (!r.ok) {
      setNeedsSetup(!!r.data.setup);
      setPassword("");
      return setError(r.error);
    }
    router.replace("/admin");
    router.refresh();
  };

  return (
    <form onSubmit={submit} className="space-y-5" noValidate>
      <div>
        <label htmlFor="email" className={labelCls}>Correo</label>
        <input id="email" type="email" autoComplete="username" required autoFocus value={email} onChange={(e) => setEmail(e.target.value)} className={inputCls} />
      </div>
      <div>
        <div className="flex items-baseline justify-between gap-3">
          <label htmlFor="password" className={labelCls}>Contraseña</label>
          <Link href="/admin/recuperar" className="text-[11px] text-ink-soft underline-offset-4 hover:underline">¿La olvidaste?</Link>
        </div>
        <input id="password" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} className={inputCls} />
      </div>
      {error && (
        <p role="alert" className="text-xs text-error">
          {error}
          {needsSetup && <> <Link href="/admin/setup" className="font-semibold underline">Ir a la configuración inicial</Link></>}
        </p>
      )}
      <button type="submit" disabled={loading || !email || !password} aria-busy={loading} className={`${btnPrimary} w-full`}>
        {loading ? "Verificando…" : "Ingresar"}
      </button>
    </form>
  );
}
