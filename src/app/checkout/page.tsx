import type { Metadata } from "next";
import { CheckoutForm } from "@/components/checkout/CheckoutForm";
import { PageBody, PageHero } from "@/components/aura/PageHero";
import { getShippingZones } from "@/lib/services/shipping-zones";
import { enviaUsesCheckoutRates } from "@/lib/envia";

export const metadata: Metadata = { title: "Checkout", description: "Completa tu pedido 7H STORE.", robots: { index: false, follow: false } };

export default async function CheckoutPage() {
  // Tarifas por zona vigentes: el checkout las usa para mostrar el envío según el departamento elegido.
  const zones = await getShippingZones();
  // Llaves Sandbox de Wompi: la pasarela no cobra dinero real. Se avisa con honestidad al comprador.
  const sandboxPayments = (process.env.WOMPI_PUBLIC_KEY ?? "").startsWith("pub_test");
  return (
    <main id="contenido">
      <PageHero quiet eyebrow="Compra segura" title="Finalizar" accent="compra." lead="Tus datos se usan solo para procesar el pedido y la entrega." />
      <PageBody>
        {sandboxPayments && (
          <div role="status" className="surface mb-8 rounded-2xl border-warning/40 bg-warning/10 p-4 text-sm">
            <strong>Pagos en modo de prueba.</strong> Por ahora la pasarela de tarjeta y PSE no realiza cobros reales. Si quieres comprar, elige transferencia o consignación, o escríbenos por WhatsApp.
          </div>
        )}
        <CheckoutForm zones={zones} liveRates={enviaUsesCheckoutRates()} />
      </PageBody>
    </main>
  );
}
