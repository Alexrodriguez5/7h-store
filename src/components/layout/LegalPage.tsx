import type { ReactNode } from "react";

/** Plantilla de páginas de ayuda y legales. Lo que falte por completar se muestra como "[Pendiente: …]". */
export function LegalPage({ title, updated, eyebrow = "Legal", children }: { title: string; updated?: string; eyebrow?: string; children: ReactNode }) {
  return (
    <main id="contenido" className="mx-auto max-w-3xl px-5 py-16 lg:px-8">
      <p className="text-[10px] font-semibold uppercase tracking-widest text-gold">{eyebrow}</p>
      <h1 className="mt-2 font-display text-4xl leading-tight sm:text-5xl">{title}</h1>
      {updated && <p className="mt-3 text-xs text-ink-soft">Última actualización: {updated}</p>}
      <div className="mt-10 space-y-8 text-sm leading-7 text-ink-soft [&_h2]:font-display [&_h2]:text-2xl [&_h2]:text-ink [&_li]:ml-5 [&_li]:list-disc [&_p+p]:mt-3 [&_strong]:text-ink [&_ul]:mt-2 [&_ul]:space-y-1">{children}</div>
    </main>
  );
}
