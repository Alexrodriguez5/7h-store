import type { ReactNode } from "react";

/** Piezas visuales compartidas del portal de clientes (marca 7H: negro, dorado y marfil). */
export const fieldCls =
  "w-full rounded-xl border border-ink/15 bg-white/80 px-4 py-3 text-sm outline-none transition-all placeholder:text-ink/35 hover:border-ink/30 focus:border-gold focus:bg-white focus:ring-4 focus:ring-gold/15 disabled:opacity-60";
export const labelCls = "mb-1.5 block text-xs font-semibold";
export const btnGold =
  "inline-flex items-center justify-center gap-2 rounded-full bg-gold px-6 py-3.5 text-sm font-semibold text-ink shadow-soft transition-all hover:bg-gold-light hover:shadow-lift active:scale-[.99] disabled:cursor-wait disabled:opacity-60";
export const btnDark =
  "inline-flex items-center justify-center gap-2 rounded-full bg-ink px-6 py-3 text-sm font-semibold text-ivory transition-colors hover:bg-gold hover:text-ink disabled:opacity-60";
export const btnLine =
  "inline-flex items-center justify-center gap-2 rounded-full border border-ink/20 bg-white/60 px-5 py-2.5 text-sm font-semibold transition-colors hover:border-gold disabled:opacity-60";

export function Panel({ title, children, action, className = "" }: { title?: string; children: ReactNode; action?: ReactNode; className?: string }) {
  return (
    <section className={`rounded-3xl border border-ink/[.07] bg-white/75 p-5 shadow-soft sm:p-7 ${className}`}>
      {(title || action) && (
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          {title && <h2 className="font-display text-2xl">{title}</h2>}
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

const tones = {
  neutral: "bg-ink/[.06] text-ink-soft",
  gold: "bg-gold/20 text-ink",
  success: "bg-success/10 text-success",
  error: "bg-error/10 text-error",
  warning: "bg-warning/10 text-warning",
};
export function Pill({ tone = "neutral", children }: { tone?: keyof typeof tones; children: ReactNode }) {
  return <span className={`inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-1 text-[11px] font-semibold ${tones[tone]}`}>{children}</span>;
}

export function Notice({ tone = "gold", children }: { tone?: "gold" | "error" | "success"; children: ReactNode }) {
  const c = tone === "error" ? "border-error/30 bg-error/5 text-error" : tone === "success" ? "border-success/30 bg-success/5 text-success" : "border-gold/40 bg-gold/5 text-ink";
  return <div role={tone === "error" ? "alert" : "status"} className={`rounded-2xl border p-4 text-sm leading-6 ${c}`}>{children}</div>;
}

export const fmtDate = (d: Date | string, withTime = false) =>
  new Intl.DateTimeFormat("es-CO", { dateStyle: "medium", ...(withTime ? { timeStyle: "short" } : {}), timeZone: "America/Bogota" }).format(new Date(d));
