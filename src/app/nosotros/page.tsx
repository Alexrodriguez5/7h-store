import type { Metadata } from "next";
import { PageBody, PageHero } from "@/components/aura/PageHero";
import { Reveal } from "@/components/home/Motion";
import { Button } from "@/components/ui/Button";
import { BRAND_PILLARS, BRAND_PROMISES, BRAND_STORY } from "@/components/brand/BrandStory";

export const metadata: Metadata = {
  title: "Sobre 7H STORE",
  description: "7H STORE existe para que encontrar productos de calidad sea más fácil, accesible y confiable: precios en COP, pagos seguros y seguimiento de cada pedido.",
  alternates: { canonical: "/nosotros" },
};

export default function AboutPage() {
  return (
    <main id="contenido">
      <PageHero eyebrow="Sobre 7H STORE" title="Comprar bien," accent="sin complicaciones." lead="Calidad. Estilo. Confianza. Tres palabras que guían cada producto que elegimos y cada pedido que enviamos." />
      <PageBody className="max-w-6xl">
        <div className="grid gap-8 lg:grid-cols-[1.25fr_1fr]">
          <div className="surface animate-fade-up rounded-[28px] p-7 sm:p-12">
            <p className="text-[10px] font-semibold uppercase tracking-[.3em] text-gold">Nuestra razón de ser</p>
            <div className="mt-6 space-y-5">
              {BRAND_STORY.map((p, i) => (
                <p key={i} className={i === 0 ? "font-display text-3xl leading-tight sm:text-4xl" : "text-base leading-8 text-ink-soft"}>{p}</p>
              ))}
            </div>
          </div>
          <div className="aura-bg grain animate-fade-up relative isolate overflow-hidden rounded-[28px] p-7 text-ivory sm:p-10">
            <p className="text-[10px] font-semibold uppercase tracking-[.3em] text-gold-light">Lo que te garantizamos</p>
            <ul className="mt-6 space-y-4">
              {BRAND_PROMISES.map((t) => (
                <li key={t} className="flex gap-3 text-sm leading-6 text-ivory/80">
                  <span aria-hidden="true" className="mt-2 size-1.5 shrink-0 rounded-full bg-gold-light shadow-[0_0_10px_rgb(216_184_102)]" />
                  {t}
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="mt-8 grid gap-4 md:grid-cols-3">
          {BRAND_PILLARS.map(({ Icon, title, text }, i) => (
            <Reveal key={title} delay={i * 100} className="surface surface-hover group rounded-[24px] p-7">
              <span className="grid size-12 place-items-center rounded-full bg-ink text-gold-light transition-colors group-hover:bg-gold group-hover:text-ink">
                <Icon width={22} height={22} />
              </span>
              <h2 className="mt-5 font-display text-3xl">{title}</h2>
              <p className="mt-2 text-sm leading-6 text-ink-soft">{text}</p>
            </Reveal>
          ))}
        </div>

        <div className="mt-10 flex flex-wrap justify-center gap-3">
          <Button href="/catalogo" variant="gold">Explorar la tienda</Button>
          <Button href="/preguntas-frecuentes" variant="secondary">Preguntas frecuentes</Button>
        </div>
      </PageBody>
    </main>
  );
}
