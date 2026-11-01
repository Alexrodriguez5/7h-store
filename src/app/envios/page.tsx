import type { Metadata } from "next";
import Link from "next/link";
import { LegalPage } from "@/components/layout/LegalPage";
import { BUSINESS, orPending } from "@/lib/business";
import { formatCOP } from "@/lib/format";
import { DEFAULT_ETA, FLAT_SHIPPING_COP, FREE_SHIPPING_THRESHOLD, etaText } from "@/lib/shipping";
import { getShippingZones } from "@/lib/services/shipping-zones";
import { enviaUsesCheckoutRates } from "@/lib/envia";
import { minShippingCOP } from "@/lib/services/shipping-quote";

export const metadata: Metadata = {
  title: "Envíos",
  description: `Envíos a toda Colombia. Gratis en compras desde ${formatCOP(FREE_SHIPPING_THRESHOLD)}.`,
  alternates: { canonical: "/envios" },
};

/** Costos tomados de src/lib/shipping.ts (los mismos que cobra el checkout). */
export default async function ShippingPage() {
  const zones = await getShippingZones();
  // Con tarifas reales de la transportadora activas, la tabla por zona solo es respaldo: se informa lo que de verdad se cobra.
  const live = enviaUsesCheckoutRates();
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
          {live && <li>Por debajo de ese valor cobramos la <strong>tarifa real de la transportadora</strong> según tu ciudad y el peso del pedido, <strong>desde {formatCOP(minShippingCOP())}</strong>.</li>}
          {!live && zones.length === 0 && <li>Tarifa única de <strong>{formatCOP(FLAT_SHIPPING_COP)}</strong> para compras por debajo de ese valor.</li>}
          <li>El costo exacto según tu departamento y el peso del pedido aparece en el checkout antes de pagar.</li>
        </ul>
        {!live && zones.length > 0 && (
          <div className="mt-4 overflow-x-auto rounded-2xl border border-ink/10 bg-white/50">
            <table className="w-full min-w-[520px] text-left text-sm">
              <thead><tr className="text-[10px] uppercase tracking-widest"><th className="px-4 py-3">Zona</th><th className="px-4 py-3">Tarifa</th><th className="px-4 py-3">Plazo estimado</th></tr></thead>
              <tbody className="divide-y divide-ink/10">
                {zones.map((z) => (
                  <tr key={z.name}>
                    <td className="px-4 py-3"><strong>{z.name}</strong><span className="block text-xs">{z.departments.join(", ")}</span></td>
                    <td className="px-4 py-3">{formatCOP(z.priceCOP)}{z.extraPerKgCOP > 0 && <span className="block text-xs">hasta {z.baseWeightGrams / 1000} kg; +{formatCOP(z.extraPerKgCOP)} por kg adicional</span>}</td>
                    <td className="px-4 py-3">{etaText(z.minDays, z.maxDays)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
      <section>
        <h2>Plazo de entrega</h2>
        <p>Plazo estimado: <strong>{BUSINESS.shippingTime ?? DEFAULT_ETA}</strong> según la zona, contado desde la confirmación del pago. Los tiempos dependen de la transportadora y pueden variar en temporadas altas o zonas de difícil acceso.</p>
      </section>
      <section>
        <h2>Seguimiento</h2>
        <p>Cuando despachamos tu pedido registramos la transportadora y el número de guía. Los ves en <Link href="/cuenta/pedidos" className="underline">Mi cuenta → Mis pedidos</Link>: entra con el mismo correo de la compra (por Google, código al correo o contraseña) y verás todos tus pedidos, aunque hayas comprado sin cuenta.</p>
      </section>
    </LegalPage>
  );
}
