export const FREE_SHIPPING_THRESHOLD = 500_000;
/** Tarifa de respaldo cuando el destino no pertenece a ninguna zona configurada (la tarifa histórica de la tienda). */
export const FLAT_SHIPPING_COP = 18_000;
/** Peso que se asume para un producto sin peso registrado. */
export const DEFAULT_WEIGHT_GRAMS = 1_000;
/** Plazo de respaldo (texto) cuando no hay zona configurada. */
export const DEFAULT_ETA = "5 a 10 días hábiles";

/** Tarifa base sin destino (carrito). Se mantiene por compatibilidad: el checkout usa `quoteShipping`. */
export function calculateShipping(subtotalCOP: number): number { return subtotalCOP >= FREE_SHIPPING_THRESHOLD ? 0 : FLAT_SHIPPING_COP; }
export function amountToFreeShipping(subtotalCOP: number): number { return Math.max(0, FREE_SHIPPING_THRESHOLD - subtotalCOP); }

/** Datos públicos de una zona (lo que necesita el checkout para cotizar). */
export interface ShippingZoneRule {
  name: string;
  departments: string[];
  priceCOP: number;
  baseWeightGrams: number;
  extraPerKgCOP: number;
  minDays: number;
  maxDays: number;
}

export interface ShippingQuote {
  costCOP: number;
  /** Nombre de la zona aplicada, o null si se usó la tarifa de respaldo. */
  zone: string | null;
  eta: string;
  free: boolean;
}

export const etaText = (minDays: number, maxDays: number) =>
  minDays === maxDays ? `${minDays} día${minDays === 1 ? "" : "s"} hábil${minDays === 1 ? "" : "es"}` : `${minDays} a ${maxDays} días hábiles`;

/** Zona que cubre un departamento (la primera en orden), o null. */
export const zoneFor = (department: string | undefined | null, zones: readonly ShippingZoneRule[]) =>
  (department && zones.find((z) => z.departments.includes(department))) || null;

/**
 * Cotización de envío. Función pura: la usan el checkout (para mostrar el valor) y el servidor
 * (que es el que cobra, con los pesos reales de la base de datos).
 * - Envío gratis desde FREE_SHIPPING_THRESHOLD (promesa publicada en toda la tienda).
 * - Con zona: precio base (cubre hasta baseWeightGrams) + extraPerKgCOP por cada kg adicional o fracción.
 * - Sin zona para el destino: tarifa histórica FLAT_SHIPPING_COP.
 */
export function quoteShipping(input: { subtotalCOP: number; weightGrams: number; department?: string | null; zones: readonly ShippingZoneRule[] }): ShippingQuote {
  const zone = zoneFor(input.department, input.zones);
  const eta = zone ? etaText(zone.minDays, zone.maxDays) : DEFAULT_ETA;
  if (input.subtotalCOP >= FREE_SHIPPING_THRESHOLD) return { costCOP: 0, zone: zone?.name ?? null, eta, free: true };
  if (!zone) return { costCOP: FLAT_SHIPPING_COP, zone: null, eta, free: false };
  const extraGrams = Math.max(0, Math.round(input.weightGrams) - zone.baseWeightGrams);
  const extraKg = Math.ceil(extraGrams / 1000);
  return { costCOP: zone.priceCOP + extraKg * zone.extraPerKgCOP, zone: zone.name, eta, free: false };
}

/** Peso total de un carrito/pedido; los productos sin peso cuentan como DEFAULT_WEIGHT_GRAMS. */
export const totalWeight = (lines: readonly { weightGrams?: number | null; quantity: number }[]) =>
  lines.reduce((g, l) => g + (l.weightGrams && l.weightGrams > 0 ? l.weightGrams : DEFAULT_WEIGHT_GRAMS) * l.quantity, 0);
