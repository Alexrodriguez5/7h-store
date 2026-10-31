import type { Metadata } from "next";
import Link from "next/link";
import { LegalPage } from "@/components/layout/LegalPage";
import { BUSINESS, orPending } from "@/lib/business";
import { formatCOP } from "@/lib/format";
import { FLAT_SHIPPING_COP, FREE_SHIPPING_THRESHOLD } from "@/lib/shipping";

export const metadata: Metadata = {
  title: "Envíos",
  description: `Envíos a toda Colombia. Gratis en compras desde ${formatCOP(FREE_SHIPPING_THRESHOLD)}.`,
  alternates: { canonical: "/envios" },
};

/** Costos tomados de src/lib/shipping.ts (los mismos que cobra el checkout). */
export default function ShippingPage() {
  return (
    <LegalPage eyebrow="Ayuda" title="Envíos" updated={orPending(BUSINESS.legalUpdated, "fecha")}>
      <section>
        <h2>Cobertura</h2>
        <p>Enviamos a todos los departamentos de Colombia. La dirección de entrega se indica en el checkout.</p>
      </section>
      <section>
        <h2>Costo del envío</h2>
        <ul>
          <li><strong>Gratis</strong> en compras desde <strong>{formatCOP(FREE_SHIPPING_THRESHOLD)}</strong>.</li>
          <li>Tarifa única de <strong>{formatCOP(FLAT_SHIPPING_COP)}</strong> para compras por debajo de ese valor.</li>
          <li>El costo exacto aparece en el carrito y en el resumen del checkout antes de pagar.</li>
        </ul>
      </section>
      <section>
        <h2>Plazo de entrega</h2>
        <p>Plazo estimado: <strong>{orPending(BUSINESS.shippingTime, "plazo de entrega por zona")}</strong>, contado desde la confirmación del pago.</p>
      </section>
      <section>
        <h2>Seguimiento</h2>
        <p>Cuando despachamos tu pedido registramos la transportadora y el número de guía. Puedes consultarlos en <Link href="/pedidos" className="underline">Rastrear pedido</Link> con tu número de pedido y el correo de la compra.</p>
      </section>
    </LegalPage>
  );
}
