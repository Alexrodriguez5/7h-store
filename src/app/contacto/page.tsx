import type { Metadata } from "next";
import { BUSINESS, whatsappUrl } from "@/lib/business";
import { PageBody, PageHero } from "@/components/aura/PageHero";
import { Reveal } from "@/components/home/Motion";
import { Button } from "@/components/ui/Button";
import { ArrowRightIcon } from "@/components/ui/Icons";

export const metadata: Metadata = {
  title: "Contacto",
  description: "Escríbenos para resolver dudas sobre productos, disponibilidad, pedidos y garantías de 7H STORE.",
  alternates: { canonical: "/contacto" },
};

/** Solo se muestran los canales configurados (src/lib/business.ts); nunca datos inventados. */
export default function ContactoPage() {
  const wa = whatsappUrl(BUSINESS.whatsapp);
  const channels = [
    { label: "Instagram", value: BUSINESS.instagram.handle, href: BUSINESS.instagram.url, text: "Novedades, disponibilidad y atención por mensaje directo." },
    wa && { label: "WhatsApp", value: `+${BUSINESS.whatsapp}`, href: wa, text: "Escríbenos para dudas sobre productos y pedidos." },
    BUSINESS.email && { label: "Correo", value: BUSINESS.email, href: `mailto:${BUSINESS.email}`, text: "Pedidos, garantías, devoluciones y PQR." },
  ].filter(Boolean) as { label: string; value: string; href: string; text: string }[];

  return (
    <main id="contenido">
      <PageHero eyebrow="Atención al cliente" title="Hablemos," accent="estamos para ayudarte." lead="Disponibilidad, pedidos, envíos y garantías. Ten a mano tu número de pedido si ya compraste." />
      <PageBody className="max-w-6xl">
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {channels.map((c, i) => (
            <Reveal key={c.label} delay={i * 90}>
              <a
                href={c.href}
                target={c.href.startsWith("http") ? "_blank" : undefined}
                rel="noreferrer"
                className="surface surface-hover group flex h-full flex-col rounded-[24px] p-7"
              >
                <p className="text-[10px] font-semibold uppercase tracking-[.3em] text-gold">{c.label}</p>
                <h2 className="mt-4 break-all font-display text-[28px] leading-tight">{c.value}</h2>
                <p className="mt-3 flex-1 text-sm leading-6 text-ink-soft">{c.text}</p>
                <span className="mt-6 inline-flex items-center gap-2 text-sm font-semibold">
                  Escribir <ArrowRightIcon width={16} height={16} className="transition-transform group-hover:translate-x-1" />
                </span>
              </a>
            </Reveal>
          ))}
        </div>
        <Reveal className="aura-bg grain relative isolate mt-8 grid gap-6 overflow-hidden rounded-[28px] p-7 text-ivory sm:p-10 lg:grid-cols-[1.4fr_1fr] lg:items-center">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[.3em] text-gold-light">Peticiones, quejas y reclamos</p>
            <p className="mt-3 font-display text-3xl leading-tight sm:text-4xl">¿Garantía, cambio o devolución?</p>
            <p className="mt-3 max-w-lg text-sm leading-7 text-ivory/70">Radícalo desde tu cuenta: recibes un número de radicado y la respuesta por correo en máximo 15 días hábiles.</p>
          </div>
          <div className="flex flex-wrap gap-3 lg:justify-end">
            <Button href="/cuenta/solicitudes" variant="gold">Crear solicitud</Button>
            <Button href="/preguntas-frecuentes" variant="secondary" className="border-ivory/30 text-ivory hover:border-gold hover:bg-white/5">Preguntas frecuentes</Button>
          </div>
        </Reveal>
      </PageBody>
    </main>
  );
}
