import { beforeEach, describe, expect, it, vi } from "vitest";
import { attemptFingerprint, attemptKeyFor, clearAttempt, submitOrder, type AttemptStorage } from "@/lib/checkout-attempt";
import { runtimeDatabaseUrl } from "@/lib/db-url";
import { EMAIL_TIMEOUT_MS, sendEmail } from "@/lib/email";
import { checkoutSchema } from "@/lib/schemas/checkout";
import { OrderAttemptConflict, attemptHash, ensurePendingPayment, placeOrder } from "@/lib/services/place-order";
import { checkoutBase, createFakeDb } from "./helpers/fake-db";

const KEY = "intento-0001-abcdefghij";
let f: ReturnType<typeof createFakeDb>;
let productId: string;
let variantId: string;
const stock = () => f.state.productVariant.find((v) => v.id === variantId)!.stock;
const input = (over: Record<string, unknown> = {}) => checkoutSchema.parse({ ...checkoutBase, items: [{ productId, size: "M", quantity: 1 }], attemptKey: KEY, ...over });

beforeEach(() => {
  f = createFakeDb();
  f.seed.category("ropa");
  const p = f.seed.product({ sizes: ["M"] });
  productId = p.id;
  variantId = f.seed.variant(p.id, "M", 5).id;
});

describe("BUG-03 · creación de pedido idempotente", () => {
  it("el primer intento crea el pedido y guarda la clave", async () => {
    const r = await placeOrder(input(), { db: f.db });
    expect(r.created).toBe(true);
    expect(f.state.order).toHaveLength(1);
    expect(f.state.order[0]).toMatchObject({ idempotencyKey: KEY, idempotencyHash: attemptHash(input()) });
    expect(stock()).toBe(4);
  });

  it("reintento con la misma clave: mismo pedido, sin segunda reserva de inventario", async () => {
    const first = await placeOrder(input(), { db: f.db });
    const again = await placeOrder(input(), { db: f.db });
    expect(again).toMatchObject({ created: false });
    expect(again.order.id).toBe(first.order.id);
    expect(again.order.publicCode).toBe(first.order.publicCode);
    expect(f.state.order).toHaveLength(1);
    expect(f.state.orderItem).toHaveLength(1);
    expect(stock()).toBe(4);
  });

  it("respuesta perdida después de crear: el reintento no vuelve a cotizar el envío ni crea otro pedido", async () => {
    const quote = vi.fn(async () => undefined);
    await placeOrder(input(), { db: f.db, quote });
    await placeOrder(input(), { db: f.db, quote });
    expect(quote).toHaveBeenCalledTimes(1);
    expect(f.state.order).toHaveLength(1);
  });

  it("doble solicitud simultánea: la que pierde choca con el índice único, revierte su reserva y devuelve el pedido ganador", async () => {
    // La segunda petición ya había comprobado que no existía pedido cuando la primera lo creó.
    // (La base de datos simulada no aísla transacciones en paralelo; la carrera real se prueba contra PostgreSQL.)
    const first = await placeOrder(input(), { db: f.db });
    const original = f.db.order.findUnique;
    let stale = true;
    f.db.order.findUnique = (async (a: never) => { if (stale) { stale = false; return null; } return original(a); }) as unknown as typeof original;
    const second = await placeOrder(input(), { db: f.db });
    expect(second.created).toBe(false);
    expect(second.order.id).toBe(first.order.id);
    expect(f.state.order).toHaveLength(1);
    expect(f.state.orderItem).toHaveLength(1);
    expect(stock()).toBe(4);
  });

  it("la misma clave con otro contenido se rechaza y no toca el pedido ni el inventario", async () => {
    await placeOrder(input(), { db: f.db });
    await expect(placeOrder(input({ items: [{ productId, size: "M", quantity: 2 }] }), { db: f.db })).rejects.toBeInstanceOf(OrderAttemptConflict);
    await expect(placeOrder(input({ customer: { ...checkoutBase.customer, email: "otra@example.com" } }), { db: f.db })).rejects.toBeInstanceOf(OrderAttemptConflict);
    expect(f.state.order).toHaveLength(1);
    expect(stock()).toBe(4);
  });

  it("claves distintas son compras distintas", async () => {
    await placeOrder(input(), { db: f.db });
    await placeOrder(input({ attemptKey: "intento-0002-abcdefghij" }), { db: f.db });
    expect(f.state.order).toHaveLength(2);
    expect(stock()).toBe(3);
  });

  it("sin clave (navegador con versión anterior en caché) el pedido se crea como antes", async () => {
    const r = await placeOrder(input({ attemptKey: undefined }), { db: f.db });
    expect(r.created).toBe(true);
    expect(f.state.order[0].idempotencyKey ?? null).toBeNull();
  });

  it("sin stock: falla, no queda pedido y la clave sigue libre para reintentar", async () => {
    f.state.productVariant.find((v) => v.id === variantId)!.stock = 0;
    await expect(placeOrder(input(), { db: f.db })).rejects.toThrow("OUT_OF_STOCK");
    expect(f.state.order).toHaveLength(0);
    f.state.productVariant.find((v) => v.id === variantId)!.stock = 1;
    expect((await placeOrder(input(), { db: f.db })).created).toBe(true);
  });

  it("un reintento no registra un segundo pago", async () => {
    const { order } = await placeOrder(input(), { db: f.db });
    const p1 = await ensurePendingPayment(order, { provider: "wompi", providerRef: order.publicCode }, f.db);
    const p2 = await ensurePendingPayment(order, { provider: "wompi", providerRef: order.publicCode }, f.db);
    expect(p2.id).toBe(p1.id);
    expect(f.state.payment).toHaveLength(1);
  });

  it("el servidor valida el formato de la clave", () => {
    expect(checkoutSchema.safeParse({ ...checkoutBase, items: [{ productId, quantity: 1 }], attemptKey: "corta" }).success).toBe(false);
    expect(checkoutSchema.safeParse({ ...checkoutBase, items: [{ productId, quantity: 1 }], attemptKey: "x'; DROP TABLE--aaaaaaaa" }).success).toBe(false);
  });
});

describe("BUG-02 · el checkout nunca queda esperando", () => {
  const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
  const payload = { attemptKey: KEY, any: 1 };
  /** fetch que nunca responde hasta que lo cancelan. */
  const hang = (_u: unknown, init?: RequestInit) => new Promise<Response>((_, reject) => init?.signal?.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError"))));
  const fast = { timeoutMs: 30, verifyTries: 2, verifyDelayMs: 1 };

  it("respuesta normal: devuelve el pedido", async () => {
    const r = await submitOrder(payload, { fetchImpl: (async () => json(201, { publicCode: "7H-ABC234", redirectUrl: "https://checkout.wompi.co/p/?x=1" })) as typeof fetch });
    expect(r).toEqual({ kind: "ok", publicCode: "7H-ABC234", redirectUrl: "https://checkout.wompi.co/p/?x=1" });
  });

  it("API que nunca responde: se corta por tiempo, se consulta el estado y se informa que es seguro reintentar", async () => {
    const calls: string[] = [];
    const onVerifying = vi.fn();
    const fetchImpl = ((u: string, init?: RequestInit) => { calls.push(`${init?.method ?? "GET"} ${u}`); return init?.method === "POST" ? hang(u, init) : Promise.resolve(json(404, { found: false })); }) as typeof fetch;
    const r = await submitOrder(payload, { ...fast, fetchImpl, onVerifying });
    expect(r).toEqual({ kind: "unknown", reason: "timeout" });
    expect(onVerifying).toHaveBeenCalledOnce();
    expect(calls).toEqual(["POST /api/orders", `GET /api/orders?intento=${KEY}`, `GET /api/orders?intento=${KEY}`]);
  });

  it("timeout pero el servidor SÍ creó el pedido: se recupera, no se pide reintentar", async () => {
    const fetchImpl = ((u: string, init?: RequestInit) => (init?.method === "POST" ? hang(u, init) : Promise.resolve(json(200, { found: true, publicCode: "7H-ABC234" })))) as typeof fetch;
    expect(await submitOrder(payload, { ...fast, fetchImpl })).toEqual({ kind: "ok", publicCode: "7H-ABC234", redirectUrl: undefined });
  });

  it("respuesta perdida (red caída tras enviar): se recupera el pedido creado", async () => {
    let n = 0;
    const fetchImpl = (async (_u: string, init?: RequestInit) => { if (init?.method === "POST") throw new TypeError("Failed to fetch"); return ++n < 2 ? json(404, { found: false }) : json(200, { found: true, publicCode: "7H-XYZ789" }); }) as typeof fetch;
    expect(await submitOrder(payload, { ...fast, fetchImpl })).toMatchObject({ kind: "ok", publicCode: "7H-XYZ789" });
  });

  it("sin conexión y sin poder verificar: estado desconocido (no se afirma que no existe)", async () => {
    const fetchImpl = (async () => { throw new TypeError("Failed to fetch"); }) as typeof fetch;
    expect(await submitOrder(payload, { ...fast, fetchImpl })).toEqual({ kind: "unknown", reason: "network" });
  });

  it("error 500 del servidor: también se verifica antes de permitir otro intento", async () => {
    const fetchImpl = (async (_u: string, init?: RequestInit) => (init?.method === "POST" ? json(500, { error: "x" }) : json(200, { found: true, publicCode: "7H-ABC234" }))) as typeof fetch;
    expect(await submitOrder(payload, { ...fast, fetchImpl })).toMatchObject({ kind: "ok", publicCode: "7H-ABC234" });
  });

  it("rechazo del servidor (sin stock): mensaje claro y sin verificación", async () => {
    const fetchImpl = vi.fn(async () => json(409, { error: "Sin stock suficiente: Camisa" })) as unknown as typeof fetch;
    expect(await submitOrder(payload, { ...fast, fetchImpl })).toEqual({ kind: "rejected", message: "Sin stock suficiente: Camisa", status: 409 });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  describe("clave del intento en el navegador", () => {
    const memory = (): AttemptStorage & { data: Map<string, string> } => { const data = new Map<string, string>(); return { data, getItem: (k) => data.get(k) ?? null, setItem: (k, v) => void data.set(k, v), removeItem: (k) => void data.delete(k) }; };
    const fp = (over: Partial<Parameters<typeof attemptFingerprint>[0]> = {}) => attemptFingerprint({ email: "ana@example.com", paymentMethod: "card", items: [{ productId: "p1", size: "M", quantity: 1 }], ...over });

    it("se conserva al recargar o reintentar el mismo intento", () => {
      const s = memory();
      const k = attemptKeyFor(fp(), s);
      expect(k).toMatch(/^[A-Za-z0-9_-]{16,64}$/);
      expect(attemptKeyFor(fp(), s)).toBe(k);
      expect(attemptKeyFor(fp({ email: " ANA@example.com " }), s)).toBe(k);
    });
    it("cambia si cambia el carrito, el correo o el medio de pago, y después de un pedido exitoso", () => {
      const s = memory();
      const k = attemptKeyFor(fp(), s);
      expect(attemptKeyFor(fp({ items: [{ productId: "p1", size: "M", quantity: 2 }] }), s)).not.toBe(k);
      const k2 = attemptKeyFor(fp({ paymentMethod: "pse" }), s);
      clearAttempt(s);
      expect(attemptKeyFor(fp({ paymentMethod: "pse" }), s)).not.toBe(k2);
    });
    it("funciona sin almacenamiento (modo privado) y con datos corruptos", () => {
      expect(attemptKeyFor(fp(), null)).toMatch(/^[A-Za-z0-9_-]{16,64}$/);
      const s = memory(); s.data.set("7h-order-attempt", "{no es json");
      expect(attemptKeyFor(fp(), s)).toMatch(/^[A-Za-z0-9_-]{16,64}$/);
    });
  });
});

describe("BUG-06 · correos con tiempo máximo", () => {
  beforeEach(() => { process.env.RESEND_API_KEY = "re_test"; process.env.EMAIL_FROM = "7H <no@7h.test>"; });
  const msg = { to: "a@b.co", subject: "s", text: "t", html: "<p>t</p>" };

  it("envía con señal de cancelación", async () => {
    const fetchImpl = vi.fn(async (_u: unknown, init?: RequestInit) => { expect(init?.signal).toBeInstanceOf(AbortSignal); return new Response("{}", { status: 200 }); });
    expect(await sendEmail(msg, fetchImpl as unknown as typeof fetch)).toBe(true);
  });
  it("proveedor que no responde: se corta, devuelve false y no lanza", async () => {
    vi.useFakeTimers();
    const spy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const hang = (_u: unknown, init?: RequestInit) => new Promise<Response>((_, reject) => init?.signal?.addEventListener("abort", () => reject(init.signal!.reason)));
    const pending = sendEmail(msg, hang as unknown as typeof fetch);
    await vi.advanceTimersByTimeAsync(EMAIL_TIMEOUT_MS + 50);
    expect(await pending).toBe(false);
    expect(String(spy.mock.calls[0]?.[1])).toContain("sin respuesta del proveedor");
    spy.mockRestore();
    vi.useRealTimers();
  });
  it("proveedor caído o que rechaza: false, sin lanzar", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    expect(await sendEmail(msg, (async () => { throw new TypeError("fetch failed"); }) as unknown as typeof fetch)).toBe(false);
    expect(await sendEmail(msg, (async () => new Response("{}", { status: 500 })) as unknown as typeof fetch)).toBe(false);
    spy.mockRestore();
  });
});

describe("BUG-01 · conexión a la base de datos", () => {
  const session = "postgresql://postgres.ref:pw@aws-0-us-west-2.pooler.supabase.com:5432/postgres";
  const params = (env: Record<string, string | undefined>, url = session) => new URL(runtimeDatabaseUrl(url, env)!);

  it("en Vercel: pooler de transacciones, 3 conexiones por instancia y esperas acotadas", () => {
    const u = params({ VERCEL: "1" });
    expect(u.port).toBe("6543");
    expect(Object.fromEntries(u.searchParams)).toMatchObject({ pgbouncer: "true", connection_limit: "3", pool_timeout: "10", connect_timeout: "10" });
  });
  it("el límite se ajusta por variable, siempre entre 1 y 5", () => {
    expect(params({ VERCEL: "1", DATABASE_CONNECTION_LIMIT: "2" }).searchParams.get("connection_limit")).toBe("2");
    expect(params({ VERCEL: "1", DATABASE_CONNECTION_LIMIT: "50" }).searchParams.get("connection_limit")).toBe("5");
    expect(params({ VERCEL: "1", DATABASE_CONNECTION_LIMIT: "0" }).searchParams.get("connection_limit")).toBe("1");
    expect(params({ VERCEL: "1", DATABASE_CONNECTION_LIMIT: "abc" }).searchParams.get("connection_limit")).toBe("3");
  });
  it("respeta lo que ya venga escrito en la URL", () => {
    expect(params({ VERCEL: "1" }, `${session}?connection_limit=1&pool_timeout=5`).searchParams.get("connection_limit")).toBe("1");
  });
});
