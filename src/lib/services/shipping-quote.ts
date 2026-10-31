import { prisma } from "@/lib/prisma";
import { FREE_SHIPPING_THRESHOLD, quoteShipping, totalWeight, type ShippingQuote } from "@/lib/shipping";
import { getShippingZones } from "@/lib/services/shipping-zones";
import { enviaUsesCheckoutRates, parcelFor, quoteRates } from "@/lib/envia";

const NAMES: Record<string, string> = { servientrega: "Servientrega", coordinadora: "Coordinadora", tcc: "TCC", interrapidisimo: "Interrapidísimo", deprisa: "Deprisa", envia: "Envía" };
export const carrierName = (c: string) => NAMES[c.toLowerCase()] ?? c.charAt(0).toUpperCase() + c.slice(1);

export interface CartLine { productId: string; quantity: number }
export type QuoteSource = "envia" | "zone";

/**
 * Cotización ÚNICA del envío de un carrito (la usan el checkout y la creación del pedido, así cobran lo mismo).
 * - Gratis desde FREE_SHIPPING_THRESHOLD.
 * - Con ENVIA_CHECKOUT_RATES=1: la tarifa real más barata de Envia, redondeada a la centena.
 * - Si Envia no responde o no está activo: tarifas por zona (panel /admin/envios).
 * Precios y pesos siempre salen de la base de datos, nunca del navegador.
 */
export async function quoteCart(input: { department: string; city: string; lines: CartLine[] }): Promise<ShippingQuote & { source: QuoteSource }> {
  const ids = [...new Set(input.lines.map((l) => l.productId))];
  const products = await prisma.product.findMany({
    where: { id: { in: ids }, active: true },
    select: { id: true, name: true, priceCOP: true, weightGrams: true, lengthCm: true, widthCm: true, heightCm: true },
  });
  const byId = new Map(products.map((p) => [p.id, p]));
  const lines = input.lines.flatMap((l) => {
    const p = byId.get(l.productId);
    return p ? [{ ...p, quantity: l.quantity }] : [];
  });
  const subtotal = lines.reduce((s, l) => s + l.priceCOP * l.quantity, 0);
  const zones = await getShippingZones();
  const zoneQuote = quoteShipping({ subtotalCOP: subtotal, weightGrams: totalWeight(lines), department: input.department, zones });

  if (subtotal >= FREE_SHIPPING_THRESHOLD || !enviaUsesCheckoutRates() || !input.city.trim()) return { ...zoneQuote, source: "zone" };
  try {
    const parcel = parcelFor(lines, subtotal);
    const [cheapest] = await quoteRates({ name: "Cliente", phone: "3000000000", email: "", street: "Dirección", city: input.city, department: input.department }, parcel);
    if (!cheapest) return { ...zoneQuote, source: "zone" };
    return {
      costCOP: Math.ceil(cheapest.totalCOP / 100) * 100,
      zone: carrierName(cheapest.carrier),
      // El plazo de la transportadora es solo el transporte: se suma la preparación del pedido.
      eta: cheapest.deliveryEstimate ? `${cheapest.deliveryEstimate} de transporte + 1 día hábil de preparación` : zoneQuote.eta,
      free: false,
      source: "envia",
    };
  } catch (e) {
    console.warn("[shipping] Envia no disponible, se usan las zonas:", e instanceof Error ? e.message : e);
    return { ...zoneQuote, source: "zone" };
  }
}
