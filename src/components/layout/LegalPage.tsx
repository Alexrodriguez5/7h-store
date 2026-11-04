import Link from "next/link";
import type { ReactNode } from "react";
import { PageBody, PageHero } from "@/components/aura/PageHero";

const HELP_LINKS = [
  { href: "/como-comprar", label: "Cómo comprar" },
  { href: "/envios", label: "Envíos" },
  { href: "/devoluciones", label: "Devoluciones y garantía" },
  { href: "/preguntas-frecuentes", label: "Preguntas frecuentes" },
  { href: "/contacto", label: "Contacto" },
  { href: "/terminos", label: "Términos y condiciones" },
  { href: "/privacidad", label: "Política de privacidad" },
];

/**
 * Plantilla de páginas de ayuda y legales (7H AURA): encabezado de marca + texto en una tarjeta clara
 * y, en computador, un índice lateral para moverse entre páginas de ayuda.
 * Lo que falte por completar se muestra como "[Pendiente: …]".
 */
export function LegalPage({ title, accent, lead, updated, eyebrow = "Legal", current, children }: {
  title: string;
  accent?: string;
  lead?: ReactNode;
  updated?: string;
  eyebrow?: string;
  /** Ruta de la página para marcarla en el índice. */
  current?: string;
  children: ReactNode;
}) {
  return (
    <main id="contenido">
      <PageHero eyebrow={eyebrow} title={title} accent={accent} lead={lead} />
      <PageBody className="max-w-6xl">
        <div className="grid gap-8 lg:grid-cols-[1fr_240px]">
          <article className="surface rounded-[28px] p-6 sm:p-10">
            {updated && <p className="mb-8 text-xs text-ink-soft">Última actualización: {updated}</p>}
            <div className="prose-aura space-y-8">{children}</div>
          </article>
          <aside className="hidden lg:block">
            <nav aria-label="Ayuda" className="surface sticky top-28 rounded-[24px] p-5">
              <p className="text-[10px] font-semibold uppercase tracking-[.3em] text-gold">Ayuda 7H</p>
              <ul className="mt-4 space-y-1 text-sm">
                {HELP_LINKS.map((l) => (
                  <li key={l.href}>
                    <Link
                      href={l.href}
                      aria-current={current === l.href ? "page" : undefined}
                      className={`block rounded-full px-3 py-2 transition-colors ${current === l.href ? "bg-ink font-semibold text-gold-light" : "text-ink-soft hover:bg-ink/[.04] hover:text-ink"}`}
                    >
                      {l.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          </aside>
        </div>
      </PageBody>
    </main>
  );
}
