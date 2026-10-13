import type { ReactNode } from "react";

/** Plantilla de páginas legales. Los textos entre [corchetes] DEBEN completarse y revisarse con un abogado antes de publicar. */
export function LegalPage({ title, updated, children }: { title: string; updated: string; children: ReactNode }) {
  return (
    <main id="contenido" className="mx-auto max-w-3xl px-5 py-16 lg:px-8">
      <p className="text-[10px] font-semibold uppercase tracking-widest text-gold">Legal</p>
      <h1 className="mt-2 font-display text-5xl leading-tight">{title}</h1>
      <p className="mt-3 text-xs text-ink-soft">Última actualización: {updated}</p>
      <div className="mt-10 space-y-8 text-sm leading-7 text-ink-soft [&_h2]:font-display [&_h2]:text-2xl [&_h2]:text-ink [&_li]:ml-5 [&_li]:list-disc [&_strong]:text-ink">{children}</div>
    </main>
  );
}
