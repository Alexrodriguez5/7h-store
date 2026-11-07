import type { Metadata } from "next";
import Link from "next/link";
import { PageBody, PageHero } from "@/components/aura/PageHero";
import { faqs } from "@/content/faq";

export const metadata: Metadata = {
  title: "Preguntas frecuentes",
  description: "Pagos, envíos, seguimiento, devoluciones y garantía en 7H STORE, respondidos en un solo lugar.",
  alternates: { canonical: "/preguntas-frecuentes" },
};

export default function FaqPage() {
  const groups = faqs();
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: groups.flatMap((g) => g.items.map((i) => ({ "@type": "Question", name: i.q, acceptedAnswer: { "@type": "Answer", text: i.plain } }))),
  };
  return (
    <main id="contenido">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />
      <PageHero eyebrow="Ayuda" title="Preguntas" accent="frecuentes." lead="Lo que más nos preguntan sobre pagos, envíos, seguimiento y garantías, respondido en un solo lugar." />
      <PageBody className="max-w-4xl">
        <div className="space-y-8">
          {groups.map((g) => (
            <section key={g.group} className="surface rounded-[28px] p-5 sm:p-8">
              <h2 className="px-1 font-display text-3xl">{g.group}</h2>
              <div className="mt-4 divide-y divide-ink/[.07]">
                {g.items.map((i) => (
                  <details key={i.q} className="clean group/faq py-1">
                    <summary className="flex cursor-pointer items-center justify-between gap-4 rounded-2xl px-1 py-4 text-left text-base font-semibold transition-colors hover:text-gold">
                      {i.q}
                      <span aria-hidden="true" className="grid size-8 shrink-0 place-items-center rounded-full border border-ink/15 text-lg leading-none transition-all duration-300 group-open/faq:rotate-45 group-open/faq:border-gold group-open/faq:bg-ink group-open/faq:text-gold-light">+</span>
                    </summary>
                    <div className="panel-in prose-aura px-1 pb-5 pr-12">{i.a}</div>
                  </details>
                ))}
              </div>
            </section>
          ))}
          <p className="text-center text-sm text-ink-soft">
            ¿No encontraste tu respuesta? <Link href="/contacto" className="font-semibold text-ink underline-offset-4 hover:text-gold hover:underline">Escríbenos</Link>
          </p>
        </div>
      </PageBody>
    </main>
  );
}
