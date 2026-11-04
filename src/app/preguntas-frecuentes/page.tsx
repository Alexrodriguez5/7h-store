import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { PageBody, PageHero } from "@/components/aura/PageHero";
import { BUSINESS } from "@/lib/business";
import { formatCOP } from "@/lib/format";
import { DEFAULT_ETA, FREE_SHIPPING_THRESHOLD } from "@/lib/shipping";

export const metadata: Metadata = {
  title: "Preguntas frecuentes",
  description: "Pagos, envíos, seguimiento, devoluciones y garantía en 7H STORE, respondidos en un solo lugar.",
  alternates: { canonical: "/preguntas-frecuentes" },
};

/**
 * Cada respuesta resume lo que ya dicen Envíos, Devoluciones y Términos (mismas cifras, mismas fuentes).
 * Si cambias una política, cambia también aquí.
 */
function faqs(): { group: string; items: { q: string; a: ReactNode; plain: string }[] }[] {
  const free = formatCOP(FREE_SHIPPING_THRESHOLD);
  const eta = BUSINESS.shippingTime ?? DEFAULT_ETA;
  return [
    {
      group: "Productos y pagos",
      items: [
        { q: "¿Los precios incluyen impuestos?", plain: "Sí. Todos los precios están en pesos colombianos (COP) e incluyen los impuestos aplicables.", a: <>Sí. Todos los precios están en pesos colombianos (COP) e incluyen los impuestos aplicables.</> },
        { q: "¿Qué medios de pago aceptan?", plain: "Tarjeta y PSE a través de Wompi, transferencia y consignación. 7H STORE no almacena los datos de tu tarjeta.", a: <>Tarjeta y PSE a través de Wompi, transferencia y consignación. 7H STORE no almacena los datos de tu tarjeta.</> },
        { q: "¿Cuánto tiempo tengo para pagar?", plain: "Al crear el pedido reservamos las unidades durante 24 horas. Si el pago no se completa en ese plazo, el pedido expira y las unidades se liberan.", a: <>Al crear el pedido reservamos las unidades durante <strong>24 horas</strong>. Si el pago no se completa en ese plazo, el pedido expira y las unidades se liberan.</> },
        { q: "¿Necesito crear una cuenta para comprar?", plain: "No. Puedes comprar como invitado. Si después entras con el mismo correo de la compra, verás todos tus pedidos en Mi cuenta.", a: <>No. Puedes comprar como invitado. Si después entras con el mismo correo de la compra, verás todos tus pedidos en <Link href="/cuenta">Mi cuenta</Link>.</> },
      ],
    },
    {
      group: "Envíos y seguimiento",
      items: [
        { q: "¿Hacen envíos a toda Colombia?", plain: "Sí, a todos los departamentos, con transportadora y número de guía.", a: <>Sí, a todos los departamentos, con transportadora y número de guía.</> },
        { q: "¿Cuánto cuesta el envío?", plain: `Es gratis en compras desde ${free}. En compras menores, el costo según tu ciudad aparece en el checkout antes de pagar.`, a: <>Es <strong>gratis en compras desde {free}</strong>. En compras menores, el costo según tu ciudad aparece en el checkout antes de pagar. Más detalles en <Link href="/envios">Envíos</Link>.</> },
        { q: "¿Cuánto tarda en llegar?", plain: `Plazo estimado: ${eta}, contado desde la confirmación del pago. Puede variar en temporadas altas o zonas de difícil acceso.`, a: <>Plazo estimado: <strong>{eta}</strong>, contado desde la confirmación del pago. Puede variar en temporadas altas o zonas de difícil acceso.</> },
        { q: "¿Cómo sigo mi pedido?", plain: "Entra a Mi cuenta con el correo de la compra. Verás el estado del pago, la transportadora y la guía de todos tus pedidos.", a: <>Entra a <Link href="/pedidos">Mi cuenta</Link> con el correo de la compra. Verás el estado del pago, la transportadora y la guía de todos tus pedidos.</> },
      ],
    },
    {
      group: "Devoluciones y garantía",
      items: [
        { q: "¿Puedo retractarme de la compra?", plain: "Sí. Tienes 5 días hábiles desde la entrega (art. 47, Ley 1480 de 2011), salvo las excepciones legales. Te devolvemos el dinero en máximo 15 días calendario.", a: <>Sí. Tienes <strong>5 días hábiles</strong> desde la entrega (art. 47, Ley 1480 de 2011), salvo las excepciones legales. Te devolvemos el dinero en máximo <strong>15 días calendario</strong>. Mira <Link href="/devoluciones">Devoluciones</Link>.</> },
        { q: "¿Los productos tienen garantía?", plain: "Sí, la garantía legal de calidad, idoneidad y seguridad. Si el fabricante no indica un plazo, es de un año desde la entrega.", a: <>Sí, la garantía legal de calidad, idoneidad y seguridad. Si el fabricante no indica un plazo, es de <strong>un año</strong> desde la entrega.</> },
        { q: "¿Cómo presento una petición, queja o reclamo?", plain: "Desde Mi cuenta → Solicitudes y garantías recibes un número de radicado. Respondemos en máximo 15 días hábiles.", a: <>Desde <Link href="/cuenta/solicitudes">Mi cuenta → Solicitudes y garantías</Link> recibes un número de radicado. Respondemos en máximo <strong>15 días hábiles</strong>. También puedes escribirnos por <Link href="/contacto">Contacto</Link>.</> },
      ],
    },
  ];
}

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
