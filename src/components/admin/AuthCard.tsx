import type { ReactNode } from "react";

/** Marco común de las pantallas de acceso del panel (login, configuración inicial, recuperación). */
export function AuthCard({ title, subtitle, children }: { title?: string; subtitle?: ReactNode; children: ReactNode }) {
  return (
    <main id="contenido" className="flex min-h-screen items-center justify-center bg-ink px-5 py-10">
      <div className="w-full max-w-sm border border-white/10 bg-ivory p-8">
        <p className="font-display text-3xl font-semibold tracking-widest">7H STORE</p>
        <p className="mt-1 text-[10px] font-semibold uppercase tracking-[0.25em] text-gold">Administración</p>
        {title && <h1 className="mt-6 font-display text-2xl leading-tight">{title}</h1>}
        {subtitle && <div className="mt-2 text-xs leading-5 text-ink-soft">{subtitle}</div>}
        <div className="mt-6">{children}</div>
      </div>
    </main>
  );
}
