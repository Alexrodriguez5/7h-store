import type { Metadata } from "next";
import Link from "next/link";
import { LegalPage } from "@/components/layout/LegalPage";
import { BUSINESS, orPending } from "@/lib/business";

export const metadata: Metadata = {
  title: "Términos y condiciones",
  description: "Condiciones de compra en 7H STORE: precios, pagos, envíos, derecho de retracto, garantía y PQR.",
  alternates: { canonical: "/terminos" },
};

/**
 * Los datos del negocio salen de src/lib/business.ts (variables NEXT_PUBLIC_BUSINESS_*).
 * Lo que falte se muestra como "[Pendiente: …]". Haz revisar el texto por un abogado antes de vender.
 * Normas de referencia en Colombia: Ley 1480 de 2011 (Estatuto del Consumidor) y Decreto 1074 de 2015.
 */
export default function TermsPage() {
  return (
    <LegalPage title="Términos y condiciones" updated={orPending(BUSINESS.legalUpdated, "fecha")}>
      <section>
        <h2>1. Quiénes somos</h2>
        <p><strong>7H STORE</strong> es operada por <strong>{orPending(BUSINESS.legalName, "razón social o nombre del titular")}</strong>, identificado con <strong>{orPending(BUSINESS.taxId, "NIT o cédula")}</strong>, con domicilio en <strong>{orPending(BUSINESS.city, "ciudad")}, Colombia</strong>. Contacto: <strong>{orPending(BUSINESS.email, "correo")}</strong> · <strong>{orPending(BUSINESS.whatsapp, "WhatsApp")}</strong> · Instagram <strong>{BUSINESS.instagram.handle}</strong>.</p>
      </section>
      <section>
        <h2>2. Productos y precios</h2>
        <p>Los precios se publican en pesos colombianos (COP) e incluyen los impuestos aplicables. Las imágenes son ilustrativas. La disponibilidad se confirma al crear el pedido: las unidades quedan reservadas durante 24 horas mientras se completa el pago.</p>
      </section>
      <section>
        <h2>3. Pedidos y pagos</h2>
        <ul>
          <li>Tarjeta y PSE se procesan a través de Wompi; 7H STORE no almacena datos de tarjetas.</li>
          <li>Transferencia y consignación: el pedido se confirma cuando verificamos el dinero en la cuenta.</li>
          <li>Si el pago no se completa en 24 horas, el pedido expira y las unidades se liberan.</li>
        </ul>
      </section>
      <section>
        <h2>4. Envíos</h2>
        <p>Enviamos a toda Colombia. Los plazos y costos se informan en <Link href="/envios" className="underline">Envíos</Link> y en el checkout. Plazo estimado de entrega: {orPending(BUSINESS.shippingTime, "plazo de entrega")}.</p>
      </section>
      <section>
        <h2>5. Derecho de retracto, cambios y garantía</h2>
        <p>Para compras a distancia aplica el derecho de retracto de 5 días hábiles desde la entrega (art. 47, Ley 1480 de 2011), salvo las excepciones legales. La garantía legal y las condiciones de cambios están en <Link href="/devoluciones" className="underline">Devoluciones</Link>.</p>
      </section>
      <section>
        <h2>6. Reversión del pago</h2>
        <p>En los casos previstos en el artículo 51 de la Ley 1480 de 2011 puedes solicitar la reversión del pago dentro de los 5 días hábiles siguientes a la fecha en que tuviste noticia de la causal, escribiendo a <strong>{orPending(BUSINESS.email, "correo")}</strong>.</p>
      </section>
      <section>
        <h2>7. Datos personales</h2>
        <p>Tratamos tus datos según nuestra <Link href="/privacidad" className="underline">Política de privacidad</Link>.</p>
      </section>
      <section>
        <h2>8. PQR</h2>
        <p>Peticiones, quejas y reclamos: <strong>{orPending(BUSINESS.email, "correo")}</strong>. Respondemos en un máximo de 15 días hábiles.</p>
      </section>
    </LegalPage>
  );
}
