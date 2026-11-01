/**
 * Integración con Envia.com (https://docs.envia.com): cotización de envíos y generación de guías
 * con transportadoras colombianas (Servientrega, Coordinadora, TCC, Interrapidísimo…).
 *
 * Variables (solo servidor):
 * - ENVIA_API_TOKEN   token de Envia (Desarrolladores → API Keys). Sin él, la integración está apagada.
 * - ENVIA_ENV         "sandbox" (por defecto) o "production". Cada token solo sirve en su ambiente.
 * - ENVIA_CARRIERS    transportadoras a cotizar, separadas por coma (por defecto "servientrega,coordinadora").
 * - ENVIA_CHECKOUT_RATES "1" para cobrar en el checkout la tarifa real de Envia (si no, se usan las zonas).
 * El origen (remitente) sale de los datos del vendedor (NEXT_PUBLIC_BUSINESS_*).
 */
import { BUSINESS } from "@/lib/business";

export const isEnviaConfigured = () => !!process.env.ENVIA_API_TOKEN?.trim();
export const enviaUsesCheckoutRates = () => isEnviaConfigured() && process.env.ENVIA_CHECKOUT_RATES === "1";
const isProd = () => process.env.ENVIA_ENV === "production";
const API = () => (isProd() ? "https://api.envia.com" : "https://api-test.envia.com");
export const enviaCarriers = () =>
  (process.env.ENVIA_CARRIERS ?? "servientrega,coordinadora").split(",").map((c) => c.trim().toLowerCase()).filter(Boolean);

/** Código de 2 letras de Envia para cada departamento (fuente: queries.envia.com/state?country_code=CO). */
export const ENVIA_STATE: Record<string, string> = {
  Amazonas: "AM", Antioquia: "AN", Arauca: "AR", "Atlántico": "AT", "Bogotá D.C.": "DC", "Bolívar": "BL", "Boyacá": "BY",
  Caldas: "CL", "Caquetá": "CA", Casanare: "CS", Cauca: "CU", Cesar: "CE", "Chocó": "CH", "Córdoba": "CO", Cundinamarca: "CN",
  "Guainía": "GU", Guaviare: "GA", Huila: "HU", "La Guajira": "LG", Magdalena: "MA", Meta: "ME", "Nariño": "NA",
  "Norte de Santander": "NS", Putumayo: "PU", "Quindío": "QU", Risaralda: "RI", "San Andrés y Providencia": "SA",
  Santander: "SN", Sucre: "SU", Tolima: "TO", "Valle del Cauca": "VC", "Vaupés": "VA", Vichada: "VI",
};

export class EnviaError extends Error {}

type Fetch = typeof fetch;

async function call<T>(path: string, body: unknown, fetchImpl: Fetch = fetch, auth = true): Promise<T> {
  const res = await fetchImpl(`${API()}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(auth ? { Authorization: `Bearer ${process.env.ENVIA_API_TOKEN}` } : {}) },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(15_000),
  });
  const text = await res.text();
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new EnviaError(res.status === 401 ? "Token de Envia inválido o de otro ambiente." : `Envia respondió ${res.status}.`);
  }
  const d = data as { meta?: string; error?: { message?: string; description?: string } };
  if (!res.ok || d.meta === "error") throw new EnviaError(d.error?.message ?? d.error?.description ?? `Envia respondió ${res.status}.`);
  return data as T;
}

const dane = new Map<string, { city: string; state: string; name: string }>();

/** Ciudad → código DANE de 8 dígitos que exigen las transportadoras colombianas (con caché en memoria). */
export async function locateCity(city: string, department: string, fetchImpl: Fetch = fetch) {
  const state = ENVIA_STATE[department];
  if (!state) throw new EnviaError(`Departamento no reconocido: ${department}`);
  const key = `${state}:${city.trim().toLowerCase()}`;
  const hit = dane.get(key);
  if (hit) return hit;
  const r = await call<{ city: string; name: string; state: string }>("/locate", { city: city.trim(), state, country: "CO" }, fetchImpl, false);
  if (!r.city) throw new EnviaError(`No encontramos el municipio "${city}" en ${department}.`);
  dane.set(key, r);
  return r;
}

export interface Parcel { weightKg: number; lengthCm: number; widthCm: number; heightCm: number; declaredValueCOP: number; content: string }

export interface EnviaAddress { name: string; phone: string; email: string; street: string; city: string; department: string; idNumber?: string; reference?: string }

const digits = (s: string) => s.replace(/\D/g, "");

async function toEnviaAddress(a: EnviaAddress, fetchImpl: Fetch) {
  const loc = await locateCity(a.city, a.department, fetchImpl);
  return {
    name: a.name.slice(0, 60), company: "", email: a.email, phone: digits(a.phone).slice(-10), phone_code: "CO",
    street: a.street.slice(0, 120), number: "", district: "", reference: (a.reference ?? "").slice(0, 120),
    city: loc.city, postalCode: loc.city, state: loc.state, country: "CO", identificationNumber: a.idNumber ?? "",
  };
}

/** Remitente: datos del vendedor configurados en la tienda. */
export function originAddress(): EnviaAddress {
  const city = (BUSINESS.city ?? "").split(",")[0].trim();
  const department = (BUSINESS.city ?? "").split(",")[1]?.trim() || "Meta";
  if (!city || !BUSINESS.address || !BUSINESS.whatsapp) throw new EnviaError("Faltan los datos del remitente (ciudad, dirección y teléfono del vendedor).");
  return {
    name: BUSINESS.legalName ?? "7H STORE", phone: BUSINESS.whatsapp, email: BUSINESS.email ?? "", street: BUSINESS.address,
    city, department, idNumber: digits(BUSINESS.taxId ?? ""),
  };
}

const pkg = (p: Parcel) => ({
  type: "box", content: p.content.slice(0, 60), amount: 1, name: "Paquete 7H STORE", declaredValue: Math.round(p.declaredValueCOP),
  lengthUnit: "CM", weightUnit: "KG", weight: Math.max(1, Math.ceil(p.weightKg)),
  dimensions: { length: p.lengthCm, width: p.widthCm, height: p.heightCm },
});

export interface EnviaRate { carrier: string; service: string; serviceDescription: string; totalCOP: number; deliveryEstimate: string | null }

interface RateResponse { data?: { carrier: string; service: string; serviceDescription?: string; totalPrice: number; currency?: string; deliveryEstimate?: string }[] }

/** Cotiza con cada transportadora configurada (en paralelo) y devuelve las tarifas ordenadas de menor a mayor. */
export async function quoteRates(destination: EnviaAddress, parcel: Parcel, fetchImpl: Fetch = fetch): Promise<EnviaRate[]> {
  const [origin, dest] = await Promise.all([toEnviaAddress(originAddress(), fetchImpl), toEnviaAddress(destination, fetchImpl)]);
  const results = await Promise.allSettled(
    enviaCarriers().map((carrier) =>
      call<RateResponse>("/ship/rate/", { origin, destination: dest, packages: [pkg(parcel)], settings: { currency: "COP" }, shipment: { type: 1, carrier, reverse_pickup: 0, import: 0 } }, fetchImpl),
    ),
  );
  // Si TODAS las transportadoras fallan (p. ej. token inválido), se informa el error en vez de "sin tarifas".
  const firstError = results.find((r): r is PromiseRejectedResult => r.status === "rejected");
  if (firstError && results.every((r) => r.status === "rejected")) throw firstError.reason;
  return results
    .flatMap((r) => (r.status === "fulfilled" ? r.value.data ?? [] : []))
    .filter((r) => typeof r.totalPrice === "number" && r.totalPrice > 0 && (!r.currency || r.currency === "COP"))
    .map((r) => ({ carrier: r.carrier, service: r.service, serviceDescription: r.serviceDescription ?? r.service, totalCOP: Math.ceil(r.totalPrice), deliveryEstimate: r.deliveryEstimate ?? null }))
    .sort((a, b) => a.totalCOP - b.totalCOP);
}

export interface EnviaLabel { carrier: string; service: string; trackingNumber: string; trackUrl: string | null; labelUrl: string | null; totalCOP: number }

interface GenerateResponse { data?: { carrier: string; service: string; trackingNumber: string; trackUrl?: string; label?: string; totalPrice?: number }[] }

/** Genera la guía (cobra el saldo de la cuenta de Envia en producción). */
export async function generateLabel(destination: EnviaAddress, parcel: Parcel, rate: Pick<EnviaRate, "carrier" | "service">, fetchImpl: Fetch = fetch): Promise<EnviaLabel> {
  const [origin, dest] = await Promise.all([toEnviaAddress(originAddress(), fetchImpl), toEnviaAddress(destination, fetchImpl)]);
  const r = await call<GenerateResponse>(
    "/ship/generate/",
    { origin, destination: dest, packages: [pkg(parcel)], settings: { currency: "COP", printFormat: "PDF", printSize: "STOCK_4X6" }, shipment: { carrier: rate.carrier, service: rate.service, type: 1, reverse_pickup: 0, import: 0 } },
    fetchImpl,
  );
  const d = r.data?.[0];
  if (!d?.trackingNumber) throw new EnviaError("Envia no devolvió número de guía.");
  return { carrier: d.carrier, service: d.service, trackingNumber: d.trackingNumber, trackUrl: d.trackUrl ?? null, labelUrl: d.label ?? null, totalCOP: Math.ceil(d.totalPrice ?? 0) };
}

/** Paquete del pedido: suma pesos y toma las medidas mayores (con valores por defecto si faltan). */
export function parcelFor(items: { weightGrams?: number | null; lengthCm?: number | null; widthCm?: number | null; heightCm?: number | null; quantity: number; name: string }[], declaredValueCOP: number): Parcel {
  const grams = items.reduce((g, i) => g + (i.weightGrams && i.weightGrams > 0 ? i.weightGrams : 1000) * i.quantity, 0);
  const max = (k: "lengthCm" | "widthCm" | "heightCm", def: number) => Math.max(def, ...items.map((i) => i[k] ?? 0));
  return {
    weightKg: grams / 1000,
    lengthCm: max("lengthCm", 30),
    widthCm: max("widthCm", 20),
    heightCm: max("heightCm", 15),
    declaredValueCOP,
    content: items.map((i) => i.name).join(", ") || "Productos 7H STORE",
  };
}
