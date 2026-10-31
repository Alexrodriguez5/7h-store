import Link from "next/link";
import type { ReactNode } from "react";
import { ORDER_STATUS_LABEL, PAYMENT_METHOD_LABEL, PAYMENT_STATUS_LABEL } from "@/lib/order-status";

export const inputCls = "w-full rounded-lg border border-ink/15 bg-white px-3 py-2.5 text-sm outline-none transition-colors focus:border-gold disabled:opacity-50";
export const btnPrimary = "inline-flex items-center justify-center gap-2 rounded-full bg-ink px-5 py-2.5 text-xs font-semibold text-ivory transition-colors hover:bg-gold hover:text-ink disabled:cursor-not-allowed disabled:opacity-50";
export const btnGhost = "inline-flex items-center justify-center gap-2 rounded-full border border-ink/20 bg-white px-3.5 py-2 text-xs font-medium transition-colors hover:border-gold disabled:cursor-not-allowed disabled:opacity-50";
export const btnDanger = "inline-flex items-center justify-center gap-2 rounded-full border border-error/50 px-3.5 py-2 text-xs font-medium text-error transition-colors hover:bg-error hover:text-ivory disabled:cursor-not-allowed disabled:opacity-50";
export const labelCls = "mb-1 block text-xs font-semibold";

export const fmtDate = (d: Date | string) =>
  new Intl.DateTimeFormat("es-CO", { dateStyle: "medium", timeStyle: "short", timeZone: "America/Bogota" }).format(new Date(d));

export function PageHeader({ title, subtitle, action }: { title: string; subtitle?: string; action?: ReactNode }) {
  return (
    <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="font-display text-4xl leading-none">{title}</h1>
        {subtitle && <p className="mt-2 text-sm text-ink-soft">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

export function Card({ title, children, className = "" }: { title?: string; children: ReactNode; className?: string }) {
  return (
    <section className={`rounded-2xl border border-ink/[.07] bg-white p-5 shadow-soft ${className}`}>
      {title && <h2 className="mb-4 text-[11px] font-semibold uppercase tracking-widest text-ink-soft">{title}</h2>}
      {children}
    </section>
  );
}

export function Stat({ label, value, href, tone }: { label: string; value: ReactNode; href?: string; tone?: "warn" }) {
  const body = (
    <div className={`h-full rounded-2xl border bg-white p-5 shadow-soft transition-all ${href ? "hover:-translate-y-0.5 hover:border-gold hover:shadow-lift" : ""} ${tone === "warn" ? "border-warning/40" : "border-ink/[.07]"}`}>
      <p className="text-[11px] font-semibold uppercase tracking-widest text-ink-soft">{label}</p>
      <p className="mt-3 font-display text-3xl leading-none sm:text-4xl">{value}</p>
    </div>
  );
  return href ? <Link href={href}>{body}</Link> : body;
}

type Tone = "neutral" | "gold" | "success" | "error" | "warning";
const tones: Record<Tone, string> = {
  neutral: "border-ink/25 text-ink-soft",
  gold: "border-gold text-ink",
  success: "border-success/50 text-success",
  error: "border-error/50 text-error",
  warning: "border-warning/50 text-warning",
};
export function Badge({ tone = "neutral", children }: { tone?: Tone; children: ReactNode }) {
  return <span className={`inline-block whitespace-nowrap rounded-full border px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${tones[tone]}`}>{children}</span>;
}

const orderTone: Record<string, Tone> = { PENDING_PAYMENT: "warning", PAID: "gold", PROCESSING: "gold", SHIPPED: "gold", DELIVERED: "success", CANCELLED: "error", EXPIRED: "neutral" };
export const OrderStatusBadge = ({ status }: { status: keyof typeof ORDER_STATUS_LABEL }) => <Badge tone={orderTone[status]}>{ORDER_STATUS_LABEL[status]}</Badge>;

const payTone: Record<string, Tone> = { APPROVED: "success", PENDING: "warning", REJECTED: "error", FAILED: "error", NONE: "neutral" };
export const PaymentBadge = ({ status }: { status: keyof typeof PAYMENT_STATUS_LABEL | "NONE" }) => (
  <Badge tone={payTone[status]}>{status === "NONE" ? "Sin pago" : PAYMENT_STATUS_LABEL[status]}</Badge>
);
export const methodLabel = (m: keyof typeof PAYMENT_METHOD_LABEL) => PAYMENT_METHOD_LABEL[m];

export function EmptyRow({ cols, children }: { cols: number; children: ReactNode }) {
  return (
    <tr>
      <td colSpan={cols} className="px-4 py-14 text-center text-sm text-ink-soft">{children}</td>
    </tr>
  );
}

export const thCls = "px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-widest text-ink-soft";
export const tdCls = "px-4 py-3 align-middle text-sm";
