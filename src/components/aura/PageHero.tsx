import Link from "next/link";
import type { ReactNode } from "react";

/**
 * Encabezado de marca para TODAS las páginas internas (catálogo, ayuda, legales, cuenta, rastreo).
 * Repite el lenguaje de la portada: negro con una luz cálida, regla dorada y titular en Newsreader
 * con la parte final en dorado sólido. Sin partículas ni esferas: rápido y nítido en cualquier pantalla.
 */
export function PageHero({
  eyebrow,
  title,
  accent,
  lead,
  crumbs,
  children,
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
  /** Versión serena (checkout y pagos): sin partículas ni esfera, para no distraer. */
  quiet?: boolean;
}) {
  return (
    <section className="hero-light relative isolate overflow-hidden rounded-b-[32px] text-ivory">
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
        <p className="type-eyebrow flex items-center gap-3 text-gold-light">
          <span aria-hidden="true" className="h-px w-8 bg-gold" />
          {eyebrow}
        </p>
        <h1 className={`rise mt-5 max-w-3xl ${quiet ? "type-h2" : "type-h1"}`}>
          {title}
          {accent && <> <span className="text-aura">{accent}</span></>}
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
