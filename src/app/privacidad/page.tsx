import type { Metadata } from "next";
import { LegalPage } from "@/components/layout/LegalPage";
import { BUSINESS, orPending } from "@/lib/business";

export const metadata: Metadata = {
  title: "Política de privacidad y tratamiento de datos",
  description: "Cómo 7H STORE trata tus datos personales conforme a la Ley 1581 de 2012.",
  alternates: { canonical: "/privacidad" },
};

/**
 * PLANTILLA conforme a la Ley 1581 de 2012 y el Decreto 1377 de 2013 (Colombia).
 * Los datos del responsable salen de src/lib/business.ts. Haz revisar el texto por un abogado antes de publicar.
 */
export default function PrivacyPage() {
  return (
    <LegalPage title="Política de tratamiento de datos personales" updated={orPending(BUSINESS.legalUpdated, "fecha")}>
      <section>
        <h2>1. Responsable del tratamiento</h2>
        <p><strong>{orPending(BUSINESS.legalName, "razón social o nombre del titular")}</strong>, <strong>{orPending(BUSINESS.taxId, "NIT o cédula")}</strong>, <strong>{orPending(BUSINESS.address, "dirección")}</strong>, <strong>{orPending(BUSINESS.city, "ciudad")}</strong>. Correo para asuntos de datos: <strong>{orPending(BUSINESS.email, "correo")}</strong>.</p>
      </section>
      <section>
        <h2>2. Datos que recogemos</h2>
        <ul>
          <li>Identificación y contacto: nombre, tipo y número de documento, correo y celular.</li>
          <li>Entrega: departamento, ciudad, dirección e indicaciones.</li>
          <li>Pedido y pago: productos, valores, estado del pago y comprobantes de transferencia. No almacenamos datos de tarjetas (los procesa Wompi).</li>
        </ul>
      </section>
      <section>
        <h2>3. Finalidades</h2>
        <ul>
          <li>Procesar, entregar y hacer seguimiento a tus pedidos.</li>
          <li>Verificar pagos, prevenir fraude y cumplir obligaciones contables y legales.</li>
          <li>Atender peticiones, quejas, reclamos y garantías.</li>
          <li>Enviarte novedades y promociones, solo si lo autorizas expresamente. Hoy la tienda no envía publicidad.</li>
        </ul>
      </section>
      <section>
        <h2>4. Con quién los compartimos</h2>
        <p>Con la pasarela de pagos (Wompi), la transportadora que entrega tu pedido y los proveedores de infraestructura tecnológica (hosting y base de datos), únicamente para las finalidades anteriores. Nuestros proveedores de hosting y base de datos pueden almacenar la información en servidores ubicados fuera de Colombia (por ejemplo, en Canadá o Estados Unidos), con medidas de seguridad equivalentes.</p>
      </section>
      <section>
        <h2>5. Tus derechos</h2>
        <p>Conocer, actualizar, rectificar y suprimir tus datos; solicitar prueba de la autorización; ser informado del uso; revocar la autorización y presentar quejas ante la Superintendencia de Industria y Comercio. Escríbenos a <strong>{orPending(BUSINESS.email, "correo")}</strong>: respondemos consultas en máximo 10 días hábiles y reclamos en máximo 15 días hábiles.</p>
      </section>
      <section>
        <h2>6. Conservación y seguridad</h2>
        <p>Conservamos los datos durante la relación comercial y el tiempo exigido por la ley. Aplicamos medidas de seguridad como conexiones cifradas (HTTPS), acceso administrativo con cuentas individuales y registro de auditoría.</p>
      </section>
      <section>
        <h2>7. Cookies</h2>
        <p>Usamos almacenamiento local del navegador para recordar tu carrito y una cookie técnica para la sesión del panel administrativo. No usamos cookies publicitarias.</p>
      </section>
    </LegalPage>
  );
}
