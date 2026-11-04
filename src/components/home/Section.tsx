import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowRightIcon } from "@/components/ui/Icons";
import { Reveal } from "./Motion";

/**
 * Sistema de secciones de la portada (7H).
 *
 * Tres tonos que se alternan con intención, siempre a todo el ancho y con fondo SÓLIDO
 * (ninguna tarjeta cruza de una sección a otra):
 * - ink:   negro #0A0A0A con la misma luz cálida del hero (campañas y momentos de marca).
 * - ivory: marfil #F5F1E8 (producto y lectura).
 * - sand:  marfil profundo #E9E3D3 (información y servicio).
 *
 * Un solo ritmo vertical para todas: 80 px en celular, 96 px en tableta y 112 px en computador.
 */
export type Tone = "ink" | "ivory" | "sand";

const TONE: Record<Tone, string> = {
  ink: "section-ink text-ivory",
  ivory: "bg-ivory text-ink",
  sand: "bg-ivory-200 text-ink",
};

export function Section({ tone, children, className = "", id, label }: { tone: Tone; children: ReactNode; className?: string; id?: string; label?: string }) {
  return (
    <section id={id} aria-label={label} className={`relative isolate overflow-hidden ${TONE[tone]} ${className}`}>
      <div className="mx-auto max-w-7xl px-5 py-20 sm:py-24 lg:px-8 lg:py-28">{children}</div>
    </section>
  );
}

/**
 * Encabezado de sección compartido: número editorial + eyebrow con regla dorada fina, titular en
 * Newsreader y, si hace falta, una bajada y un enlace. El enlace se ve en todos los tamaños.
 */
export function SectionHeader({
  index,
  eyebrow,
  title,
  lead,
  href,
  cta,
  tone = "ivory",
  size = "h2",
  railArrows = false,
}: {
  index?: string;
  eyebrow: string;
  title: ReactNode;
  lead?: ReactNode;
  href?: string;
  cta?: string;
  tone?: Tone;
  size?: "h2" | "h3";
  /** Deja espacio a la derecha para las flechas del carrusel que va debajo. */
  railArrows?: boolean;
}) {
  const dark = tone === "ink";
  return (
    <Reveal className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
      <div className="max-w-2xl">
        <p className={`type-eyebrow flex items-center gap-3 ${dark ? "text-gold-light" : "text-gold-deep"}`}>
          {index && <span className="font-display text-sm tracking-normal">{index}</span>}
          <span aria-hidden="true" className={`h-px w-8 ${dark ? "bg-gold/70" : "bg-gold"}`} />
          {eyebrow}
        </p>
        <h2 className={`mt-4 ${size === "h2" ? "type-h2" : "type-h3"}`}>{title}</h2>
        {lead && <p className={`mt-4 max-w-xl text-[15px] leading-7 ${dark ? "text-ivory/65" : "text-ink-soft"}`}>{lead}</p>}
      </div>
      {href && cta && (
        <Link href={href} className={`group inline-flex shrink-0 items-center gap-2 text-sm font-medium transition-colors ${dark ? "text-ivory hover:text-gold-light" : "hover:text-gold-deep"} ${railArrows ? "sm:mr-28" : ""}`}>
          {cta}
          <ArrowRightIcon width={16} height={16} className="transition-transform duration-300 group-hover:translate-x-1" />
        </Link>
      )}
    </Reveal>
  );
}
