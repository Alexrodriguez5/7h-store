import type { Metadata } from "next";
import Link from "next/link";
import { LegalPage } from "@/components/layout/LegalPage";
import { BUSINESS, orPending } from "@/lib/business";

export const metadata: Metadata = {
  title: "Devoluciones, retracto y garantía",
  description: "Derecho de retracto, garantía legal y reversión del pago en 7H STORE (Ley 1480 de 2011).",
  alternates: { canonical: "/devoluciones" },
};

/**
 * Basado en la Ley 1480 de 2011 (Estatuto del Consumidor). Revisión jurídica recomendada antes de vender.
 * No se fijan plazos de garantía propios: aplican los legales hasta que el negocio defina los suyos.
 */
export default function ReturnsPage() {
  const contact = orPending(BUSINESS.email, "correo");
  return (
    <LegalPage eyebrow="Ayuda" title="Devoluciones, retracto y garantía" updated={orPending(BUSINESS.legalUpdated, "fecha")}>
      <section>
        <h2>Derecho de retracto</h2>
        <p>Como compraste a distancia, puedes retractarte dentro de los <strong>5 días hábiles</strong> siguientes a la entrega (artículo 47 de la Ley 1480 de 2011). El producto debe devolverse en las mismas condiciones en que lo recibiste, sin uso y con su empaque. Los costos de transporte de la devolución corren por tu cuenta. Te reintegramos el dinero dentro de los 30 días calendario siguientes.</p>
        <p>No aplica, entre otros, a bienes de uso personal como ropa interior, ni a productos confeccionados según tus especificaciones, conforme a las excepciones de la misma ley.</p>
      </section>
      <section>
        <h2>Garantía legal</h2>
        <p>Todos los productos tienen la garantía legal de calidad, idoneidad y seguridad prevista en la Ley 1480 de 2011 y el Decreto 735 de 2013. Si un producto presenta un defecto, escríbenos con tu número de pedido, fotos y una descripción del problema. Repararemos, cambiaremos o devolveremos el dinero según corresponda legalmente. Si el fabricante no indica un plazo, la garantía legal es de <strong>un (1) año</strong> desde la entrega (artículo 8 de la Ley 1480 de 2011).</p>
      </section>
      <section>
        <h2>Reversión del pago</h2>
        <p>Si pagaste con tarjeta o PSE y fuiste objeto de fraude, la operación no fue solicitada, el producto no se recibió o no corresponde a lo pedido o es defectuoso, puedes solicitar la reversión del pago dentro de los 5 días hábiles siguientes a la fecha en que tuviste noticia de ello (artículo 51 de la Ley 1480 de 2011 y Decreto 587 de 2016). Debes informarlo a 7H STORE y también al emisor de tu tarjeta o a tu banco. Si la solicitud procede, el dinero se reintegra en los plazos que fija la ley.</p>
      </section>
      <section>
        <h2>Cómo solicitarlo</h2>
        <ul>
          <li><strong>Lo más rápido:</strong> entra a <Link href="/cuenta/solicitudes" className="underline">Mi cuenta → Solicitudes y garantías</Link>, elige el pedido y adjunta fotos o video. Recibes un número de radicado y la respuesta por correo.</li>
          <li>También puedes escribirnos a <strong>{contact}</strong> o por Instagram <a href={BUSINESS.instagram.url} target="_blank" rel="noreferrer" className="underline">{BUSINESS.instagram.handle}</a>.</li>
          <li>Incluye tu número de pedido (por ejemplo, 7H-K4M9QX) y el correo de la compra.</li>
          <li>Conserva el producto, el empaque y el comprobante mientras revisamos la solicitud.</li>
        </ul>
        <p>Consulta también los <Link href="/terminos" className="underline">Términos y condiciones</Link>.</p>
      </section>
    </LegalPage>
  );
}
