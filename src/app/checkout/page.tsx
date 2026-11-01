import type { Metadata } from "next";
import { CheckoutForm } from "@/components/checkout/CheckoutForm";
import { getShippingZones } from "@/lib/services/shipping-zones";
import { enviaUsesCheckoutRates } from "@/lib/envia";

export const metadata: Metadata = { title: "Checkout", description: "Completa tu pedido 7H STORE.", robots: { index: false, follow: false } };

export default async function CheckoutPage() {
  // Tarifas por zona vigentes: el checkout las usa para mostrar el envío según el departamento elegido.
  const zones = await getShippingZones();
  // Llaves Sandbox de Wompi: la pasarela no cobra dinero real. Se avisa con honestidad al comprador.
  const sandboxPayments = (process.env.WOMPI_PUBLIC_KEY ?? "").startsWith("pub_test");
  return (
    <main id="contenido" className="mx-auto max-w-7xl px-5 py-12 lg:px-8 lg:py-16">
      <div className="mb-10">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-gold">7H STORE</p>
        <h1 className="mt-2 font-display text-5xl">Finalizar compra</h1>
        <p className="mt-3 text-sm text-ink-soft">Tus datos se usan para procesar el pedido y la entrega.</p>
      </div>
      {sandboxPayments && (
        <div role="status" className="mb-8 rounded-2xl border border-warning/40 bg-warning/10 p-4 text-sm">
          <strong>Pagos en modo de prueba.</strong> Por ahora la pasarela de tarjeta y PSE no realiza cobros reales. Si quieres comprar, elige transferencia o consignación, o escríbenos por WhatsApp.
        </div>
      )}
      <CheckoutForm zones={zones} liveRates={enviaUsesCheckoutRates()} />
    </main>
  );
}
