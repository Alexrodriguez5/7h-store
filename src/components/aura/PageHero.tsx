import Link from "next/link";
import type { ReactNode } from "react";
import { AuraFallback } from "./AuraOrb";
import { AuraParticles } from "./AuraVisual";

/**
 * Encabezado de marca para TODAS las páginas internas (catálogo, ayuda, legales, cuenta, rastreo).
 * Repite el lenguaje de la portada: escena oscura con aura dorada, grano, partículas y una esfera
 * decorativa (versión CSS, sin WebGL, para que cargue al instante). El título usa Instrument Serif
 * con la parte final en cursiva dorada, igual que el titular de la portada.
 */
export function PageHero({
  eyebrow,
  title,
  accent,
  lead,
  crumbs,
  children,
  orb = true,
  quiet = false,
}: {
  eyebrow: string;
  title: ReactNode;
  /** Palabra o frase final en cursiva dorada. */
  accent?: ReactNode;
  lead?: ReactNode;
  /** Miga de pan opcional: [{ href, label }]. */
  crumbs?: { href: string; label: string }[];
  children?: ReactNode;
  orb?: boolean;
  /** Versión serena (checkout y pagos): sin partículas ni esfera, para no distraer. */
  quiet?: boolean;
}) {
  return (
    <section className="aura-bg grain relative isolate overflow-hidden rounded-b-[36px] text-ivory">
      {!quiet && <AuraParticles count={10} />}
      {orb && !quiet && (
        <div aria-hidden="true" className="pointer-events-none absolute -right-32 top-1/2 size-[260px] -translate-y-1/2 opacity-30 sm:-right-10 sm:size-[340px] sm:opacity-70 lg:right-[7%] lg:size-[380px] lg:opacity-90">
          <div className="aura-float size-full">
            <div aria-hidden="true" className="absolute inset-[12%] rounded-full bg-gold/25 blur-3xl" />
            <AuraFallback className="size-full" />
          </div>
        </div>
      )}
      <div className={`relative mx-auto max-w-7xl px-5 lg:px-8 ${quiet ? "pb-14 pt-8 lg:pb-16 lg:pt-10" : "pb-16 pt-10 lg:pb-20 lg:pt-14"}`}>
        {crumbs && crumbs.length > 0 && (
          <nav aria-label="Ruta" className="mb-6 text-[11px] text-ivory/55">
            <ol className="flex flex-wrap items-center gap-1.5">
              {crumbs.map((c) => (
                <li key={c.href} className="flex items-center gap-1.5">
                  <Link href={c.href} className="transition-colors hover:text-gold-light">{c.label}</Link>
                  <span aria-hidden="true">/</span>
                </li>
              ))}
            </ol>
          </nav>
        )}
        <p className="glass-dark inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-[10px] font-semibold uppercase tracking-[.3em] text-gold-light">
          <span aria-hidden="true" className="size-1.5 rounded-full bg-gold-light shadow-[0_0_10px_rgb(216_184_102)]" />
          {eyebrow}
        </p>
        <h1 className={`animate-fade-up mt-5 max-w-3xl font-display leading-[.95] ${quiet ? "text-[40px] sm:text-6xl" : "text-[44px] sm:text-7xl"}`}>
          {title}
          {accent && <> <span className="italic text-aura">{accent}</span></>}
        </h1>
        {lead && <p className="mt-5 max-w-xl text-sm leading-7 text-ivory/70 sm:text-base">{lead}</p>}
        {children && <div className="mt-7">{children}</div>}
      </div>
    </section>
  );
}

/** Contenedor de página interna: marfil con halo dorado, que se monta un poco sobre el encabezado. */
export function PageBody({ children, className = "max-w-7xl" }: { children: ReactNode; className?: string }) {
  return (
    <div className="ivory-aura">
      <div className={`relative z-10 mx-auto -mt-8 px-5 pb-8 lg:px-8 ${className}`}>{children}</div>
    </div>
  );
}
