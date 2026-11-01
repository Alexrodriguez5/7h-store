// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Los datos del vendedor se leen al importar el módulo: se definen antes.
vi.hoisted(() => {
  const e = process.env as Record<string, string | undefined>;
  e.NEXT_PUBLIC_BUSINESS_CITY = "Villavicencio, Meta";
  e.NEXT_PUBLIC_BUSINESS_ADDRESS = "Cra 10C #20-14";
  e.NEXT_PUBLIC_BUSINESS_WHATSAPP = "573204473708";
});
import { EnviaError, generateLabel, parcelFor, quoteRates, type EnviaAddress } from "@/lib/envia";

const env = process.env as Record<string, string | undefined>;
const saved = { ...env };
beforeEach(() => {
  env.ENVIA_API_TOKEN = "tok_test";
  env.ENVIA_CARRIERS = "servientrega,coordinadora";
  env.NEXT_PUBLIC_BUSINESS_CITY = "Villavicencio, Meta";
  env.NEXT_PUBLIC_BUSINESS_ADDRESS = "Cra 10C #20-14";
  env.NEXT_PUBLIC_BUSINESS_WHATSAPP = "573204473708";
});
afterEach(() => { for (const k of Object.keys(env)) if (!(k in saved)) delete env[k]; Object.assign(env, saved); });

const dest: EnviaAddress = { name: "Ana", phone: "300 123 4567", email: "ana@correo.co", street: "Calle 1", city: "Pereira", department: "Risaralda" };
const parcel = parcelFor([{ weightGrams: 2500, quantity: 1, name: "Tenis" }], 300000);

/** fetch falso que registra las peticiones. */
function fakeFetch(handler: (url: string, body: Record<string, unknown>) => unknown, status = 200) {
  const calls: { url: string; body: Record<string, unknown>; auth: string | null }[] = [];
  const f = (async (url: string, init: RequestInit) => {
    const body = JSON.parse(String(init.body));
    calls.push({ url, body, auth: new Headers(init.headers).get("authorization") });
    return new Response(JSON.stringify(handler(url, body)), { status });
  }) as unknown as typeof fetch;
  return { f, calls };
}

const locate = (body: Record<string, unknown>) => ({ city: body.city === "Pereira" ? "66001000" : "50001000", name: String(body.city).toUpperCase(), state: body.state });

describe("Envia", () => {
  it("cotiza por transportadora con códigos DANE y devuelve la más barata primero (sandbox)", async () => {
    const { f, calls } = fakeFetch((url, body) => {
      if (url.endsWith("/locate")) return locate(body);
      const carrier = (body.shipment as { carrier: string }).carrier;
      return { meta: "rate", data: [{ carrier, service: "ground", serviceDescription: "Terrestre", totalPrice: carrier === "servientrega" ? 15800.4 : 13200, currency: "COP", deliveryEstimate: "2-4 días" }] };
    });
    const rates = await quoteRates(dest, parcel, f);
    expect(rates.map((r) => r.carrier)).toEqual(["coordinadora", "servientrega"]);
    expect(rates[1].totalCOP).toBe(15801);
    const rateCall = calls.find((c) => c.url.endsWith("/ship/rate/"))!;
    expect(rateCall.url.startsWith("https://api-test.envia.com")).toBe(true);
    expect(rateCall.auth).toBe("Bearer tok_test");
    expect((rateCall.body.destination as { city: string; state: string }).city).toBe("66001000");
    expect((rateCall.body.destination as { state: string }).state).toBe("RI");
    expect((rateCall.body.origin as { state: string }).state).toBe("ME");
    expect((rateCall.body.packages as { weight: number }[])[0].weight).toBe(3);
    // /locate no lleva token
    expect(calls.find((c) => c.url.endsWith("/locate"))!.auth).toBeNull();
  });

  it("una transportadora que falla no impide cotizar con las demás", async () => {
    const { f } = fakeFetch((url, body) => {
      if (url.endsWith("/locate")) return locate(body);
      if ((body.shipment as { carrier: string }).carrier === "servientrega") return { meta: "error", error: { message: "sin cobertura" } };
      return { meta: "rate", data: [{ carrier: "coordinadora", service: "ground", totalPrice: 12000, currency: "COP" }] };
    });
    expect((await quoteRates(dest, parcel, f)).map((r) => r.carrier)).toEqual(["coordinadora"]);
  });

  it("genera la guía y devuelve número, rastreo y PDF", async () => {
    const { f } = fakeFetch((url, body) => (url.endsWith("/locate") ? locate(body) : { meta: "generate", data: [{ carrier: "servientrega", service: "ground", trackingNumber: "SV123", trackUrl: "https://t", label: "https://l.pdf", totalPrice: 15000 }] }));
    const label = await generateLabel(dest, parcel, { carrier: "servientrega", service: "ground" }, f);
    expect(label).toMatchObject({ trackingNumber: "SV123", labelUrl: "https://l.pdf", totalCOP: 15000 });
  });

  it("informa errores de Envia de forma clara", async () => {
    const { f } = fakeFetch((url, body) => (url.endsWith("/locate") ? locate(body) : { meta: "error", error: { message: "Saldo insuficiente" } }));
    await expect(generateLabel(dest, parcel, { carrier: "servientrega", service: "ground" }, f)).rejects.toBeInstanceOf(EnviaError);
  });

  it("arma el paquete con pesos reales y medidas por defecto", () => {
    const p = parcelFor([{ weightGrams: null, quantity: 2, name: "A" }, { weightGrams: 500, lengthCm: 40, quantity: 1, name: "B" }], 100000);
    expect(p.weightKg).toBe(2.5);
    expect(p.lengthCm).toBe(40);
    expect(p.widthCm).toBe(20);
  });
});
