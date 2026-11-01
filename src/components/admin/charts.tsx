"use client";

import { useMemo, useRef, useState } from "react";

/** Serie única del panel: dorado oscuro de la marca (validado: contraste ≥ 3:1 sobre blanco). */
export const SERIES = "#9A7A2C";
const GRID = "rgb(10 10 10 / .08)";

const cop = (n: number) => new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(n);
const copShort = (n: number) => (n >= 1e6 ? `$${(n / 1e6).toLocaleString("es-CO", { maximumFractionDigits: 1 })} M` : n >= 1e3 ? `$${Math.round(n / 1e3)} mil` : `$${n}`);
const dayLabel = (d: string, opts: Intl.DateTimeFormatOptions = { day: "numeric", month: "short" }) => new Date(`${d}T12:00:00`).toLocaleDateString("es-CO", opts);

/** "Bonitos" límites del eje Y: 0 y un máximo redondeado con 4 divisiones. */
function niceMax(v: number) {
  if (v <= 0) return 100_000;
  const p = 10 ** Math.floor(Math.log10(v));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * p).find((s) => s * 4 >= v) ?? 10 * p;
  return step * 4;
}

/**
 * Ventas por día: área suave + línea de 2px, con cruz y tooltip al pasar el cursor (o tocar).
 * Una sola serie: sin leyenda (el título dice qué es).
 */
export function SalesTrend({ data }: { data: { day: string; totalCOP: number; orders: number }[] }) {
  const W = 720, H = 240, L = 56, R = 12, T = 12, B = 28;
  const max = useMemo(() => niceMax(Math.max(...data.map((d) => d.totalCOP))), [data]);
  const x = (i: number) => L + (data.length <= 1 ? 0 : (i / (data.length - 1)) * (W - L - R));
  const y = (v: number) => T + (1 - v / max) * (H - T - B);
  const line = data.map((d, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(d.totalCOP).toFixed(1)}`).join(" ");
  const area = `${line} L${x(data.length - 1).toFixed(1)},${y(0)} L${x(0).toFixed(1)},${y(0)} Z`;
  const [hover, setHover] = useState<number | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((f) => f * max);
  const every = Math.ceil(data.length / 6);
  const best = data.reduce((b, d, i) => (d.totalCOP > data[b].totalCOP ? i : b), 0);

  const onMove = (clientX: number) => {
    const r = svgRef.current?.getBoundingClientRect();
    if (!r) return;
    const px = ((clientX - r.left) / r.width) * W;
    const i = Math.round(((px - L) / (W - L - R)) * (data.length - 1));
    setHover(Math.max(0, Math.min(data.length - 1, i)));
  };
  const h = hover !== null ? data[hover] : null;

  return (
    <div className="relative">
      <svg
        ref={svgRef}
        viewBox={`0 0 ${W} ${H}`}
        className="h-auto w-full touch-pan-y select-none"
        role="img"
        aria-label={`Ventas por día de los últimos ${data.length} días`}
        onPointerMove={(e) => onMove(e.clientX)}
        onPointerLeave={() => setHover(null)}
      >
        {ticks.map((t) => (
          <g key={t}>
            <line x1={L} x2={W - R} y1={y(t)} y2={y(t)} stroke={GRID} strokeWidth={1} />
            <text x={L - 8} y={y(t) + 4} textAnchor="end" className="fill-ink-soft text-[11px]">{copShort(t)}</text>
          </g>
        ))}
        {data.map((d, i) => (i % every === 0 || i === data.length - 1 ? (
          <text key={d.day} x={x(i)} y={H - 8} textAnchor={i === 0 ? "start" : i === data.length - 1 ? "end" : "middle"} className="fill-ink-soft text-[11px]">{dayLabel(d.day)}</text>
        ) : null))}
        <path d={area} fill={SERIES} opacity={0.1} />
        <path d={line} fill="none" stroke={SERIES} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
        {data[best].totalCOP > 0 && hover === null && (
          <g>
            <circle cx={x(best)} cy={y(data[best].totalCOP)} r={4.5} fill={SERIES} stroke="#fff" strokeWidth={2} />
            <text x={x(best)} y={y(data[best].totalCOP) - 10} textAnchor="middle" className="fill-ink text-[11px] font-semibold">{copShort(data[best].totalCOP)}</text>
          </g>
        )}
        {h && hover !== null && (
          <g>
            <line x1={x(hover)} x2={x(hover)} y1={T} y2={y(0)} stroke="rgb(10 10 10 / .25)" strokeWidth={1} />
            <circle cx={x(hover)} cy={y(h.totalCOP)} r={5} fill={SERIES} stroke="#fff" strokeWidth={2} />
          </g>
        )}
      </svg>
      {h && hover !== null && (
        <div
          role="status"
          className="pointer-events-none absolute top-2 z-10 rounded-xl bg-ink px-3 py-2 text-xs text-ivory shadow-lift"
          style={{ left: `${(x(hover) / W) * 100}%`, transform: `translateX(${hover > data.length / 2 ? "-105%" : "5%"})` }}
        >
          <p className="font-semibold">{((t) => t.charAt(0).toUpperCase() + t.slice(1))(dayLabel(h.day, { weekday: "long", day: "numeric", month: "long" }))}</p>
          <p className="mt-0.5">{cop(h.totalCOP)}</p>
          <p className="text-ivory/60">{h.orders} pedido(s) pagado(s)</p>
        </div>
      )}
    </div>
  );
}

/**
 * Barras horizontales ordenadas (magnitud de una sola serie). Valor al final de cada barra
 * y detalle al pasar el cursor. Barras de ≤ 20px con extremo redondeado y separación de aire.
 */
export function RankBars({ rows, empty = "Sin datos en este periodo.", unit = "cop" }: { rows: { label: string; value: number; detail?: string }[]; empty?: string; unit?: "cop" | "count" }) {
  const fmt = (n: number) => (unit === "cop" ? cop(n) : n.toLocaleString("es-CO"));
  const max = Math.max(1, ...rows.map((r) => r.value));
  const [hover, setHover] = useState<number | null>(null);
  if (!rows.length) return <p className="py-6 text-center text-sm text-ink-soft">{empty}</p>;
  return (
    <ul className="space-y-3">
      {rows.map((r, i) => (
        <li key={r.label} onPointerEnter={() => setHover(i)} onPointerLeave={() => setHover(null)} className="group">
          <div className="mb-1 flex items-baseline justify-between gap-3 text-xs">
            <span className="truncate font-medium text-ink">{r.label}</span>
            <span className="shrink-0 tabular-nums text-ink">{fmt(r.value)}</span>
          </div>
          <div className="relative h-3 rounded-r bg-ink/[.04]">
            <div className="h-3 rounded-r-[4px] transition-[width] duration-700" style={{ width: `${Math.max(2, (r.value / max) * 100)}%`, background: SERIES, opacity: hover === null || hover === i ? 1 : 0.45 }} />
          </div>
          {r.detail && <p className="mt-1 text-[11px] text-ink-soft">{r.detail}</p>}
        </li>
      ))}
    </ul>
  );
}

/** Indicador grande con variación frente al periodo anterior (texto + flecha, nunca solo color). */
export function Kpi({ label, value, current, previous, hint, invert = false }: { label: string; value: string; current?: number; previous?: number; hint?: string; invert?: boolean }) {
  let delta: { text: string; good: boolean | null } | null = null;
  if (current !== undefined && previous !== undefined) {
    if (previous === 0) delta = current > 0 ? { text: "Nuevo", good: true } : null;
    else {
      const pct = Math.round(((current - previous) / previous) * 100);
      delta = { text: `${pct > 0 ? "▲" : pct < 0 ? "▼" : "■"} ${Math.abs(pct)}%`, good: pct === 0 ? null : (pct > 0) !== invert };
    }
  }
  return (
    <div className="rounded-2xl border border-ink/[.07] bg-white p-5 shadow-soft">
      <p className="text-[11px] font-semibold uppercase tracking-widest text-ink-soft">{label}</p>
      <p className="mt-3 font-display text-3xl leading-none tabular-nums sm:text-4xl">{value}</p>
      <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px]">
        {delta && <span className={`rounded-full px-2 py-0.5 font-semibold ${delta.good === null ? "bg-ink/5 text-ink-soft" : delta.good ? "bg-success/10 text-success" : "bg-error/10 text-error"}`}>{delta.text}</span>}
        {hint && <span className="text-ink-soft">{hint}</span>}
      </div>
    </div>
  );
}
