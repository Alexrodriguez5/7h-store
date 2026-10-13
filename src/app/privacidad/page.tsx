import type { Metadata } from "next";
import { LegalPage } from "@/components/layout/LegalPage";

export const metadata: Metadata = { title: "Política de privacidad y tratamiento de datos" };

/**
 * PLANTILLA conforme a la Ley 1581 de 2012 y el Decreto 1377 de 2013 (Colombia).
 * Completa los datos entre [corchetes] y haz revisar el texto por un abogado antes de publicar.
 */
export default function PrivacyPage() {
  return (
    <LegalPage title="Política de tratamiento de datos personales" updated="[fecha]">
      <section>
        <h2>1. Responsable del tratamiento</h2>
        <p><strong>[Razón social o nombre del titular]</strong>, <strong>[NIT o cédula]</strong>, <strong>[dirección]</strong>, <strong>[ciudad]</strong>. Correo para asuntos de datos: <strong>[correo]</strong>.</p>
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
          <li>[Solo si lo autorizas expresamente: enviarte novedades y promociones.]</li>
        </ul>
      </section>
      <section>
        <h2>4. Con quién los compartimos</h2>
        <p>Con la pasarela de pagos (Wompi), la transportadora que entrega tu pedido y los proveedores de infraestructura tecnológica (hosting y base de datos), únicamente para las finalidades anteriores. [Indica si hay transferencia internacional de datos, p. ej. servidores fuera de Colombia.]</p>
      </section>
      <section>
        <h2>5. Tus derechos</h2>
        <p>Conocer, actualizar, rectificar y suprimir tus datos; solicitar prueba de la autorización; ser informado del uso; revocar la autorización y presentar quejas ante la Superintendencia de Industria y Comercio. Escríbenos a <strong>[correo]</strong>: respondemos consultas en máximo 10 días hábiles y reclamos en máximo 15 días hábiles.</p>
      </section>
      <section>
        <h2>6. Conservación y seguridad</h2>
        <p>Conservamos los datos durante la relación comercial y el tiempo exigido por la ley. Aplicamos medidas de seguridad como conexiones cifradas (HTTPS), acceso administrativo con cuentas individuales y registro de auditoría.</p>
      </section>
      <section>
        <h2>7. Cookies</h2>
        <p>Usamos almacenamiento local del navegador para recordar tu carrito y una cookie técnica para la sesión del panel administrativo. No usamos cookies publicitarias. [Actualiza si agregas analítica o píxeles de terceros.]</p>
      </section>
    </LegalPage>
  );
}
