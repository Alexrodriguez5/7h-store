import { ApiError } from "@google/genai";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({ prisma: {} }));
const mail = vi.hoisted(() => ({ sent: [] as unknown[] }));
vi.mock("@/lib/mailer", () => ({ deliverLater: (m: unknown) => mail.sent.push(m), supportInbox: () => "equipo@7hstore.app" }));
const created = vi.hoisted(() => ({ calls: [] as unknown[][] }));
vi.mock("@/lib/services/product-requests", async (orig) => {
  const real = await orig<typeof import("@/lib/services/product-requests")>();
  return { ...real, createProductRequest: async (...a: unknown[]) => { created.calls.push(a); return { code: "BUS-ABC234", duplicate: false, link: "/cuenta/busquedas/BUS-ABC234" }; } };
});

import { auraConfig } from "@/lib/aura/config";
import { handleChat, ipHash } from "@/lib/aura/chat";
import { classify } from "@/lib/aura/gemini";
import { scanPrivate } from "@/lib/aura/privacy";
import { AiError, type AiProvider, type ProviderRun } from "@/lib/aura/provider";
import { AuraRequestError, confirmAuraRequest } from "@/lib/aura/request";
import { createToolRunner, TOOL_SPECS } from "@/lib/aura/tools";
import { CODE_ALPHABET, randomRequestCode } from "@/lib/services/product-requests";
import { MemoryRateStore, setRateStore } from "@/lib/rate-limit";

/* eslint-disable @typescript-eslint/no-explicit-any */
beforeEach(() => { setRateStore(new MemoryRateStore()); mail.sent = []; created.calls = []; });
afterEach(() => setRateStore(undefined));

describe("filtro de privacidad (antes de enviar a Gemini)", () => {
  it.each([
    ["mi correo es ana.perez@gmail.com", "correo"],
    ["escríbeme a ana arroba gmail punto com", "correo"],
    ["mi cel es 300 123 4567", "celular"],
    ["llámame al +57 310-555-1234", "celular"],
    ["vivo en la Calle 10 # 20-30 de Medellín", "direccion"],
    ["me llamo Ana María Pérez y busco tenis", "nombre"],
    ["¿cómo va mi pedido 7H-A1B2C3?", "pedido"],
  ])("oculta datos de contacto: %s", (text, kind) => {
    const r = scanPrivate(text);
    expect(r.kinds).toContain(kind);
    expect(r.block).toBe(false);
    expect(r.text).toContain("[dato omitido]");
  });
  it.each([
    ["mi tarjeta es 4111 1111 1111 1111", "tarjeta"],
    ["mi contraseña es Secreta123", "clave"],
    ["mi cédula es 1.020.304.050", "documento"],
    ["consígname a Bancolombia ahorros 123-456789-01", "cuenta_bancaria"],
    ["este es el número 52987654", "documento"],
    ["mi clave de api es AIzaSyD1234567890abcdefghijklmnopqrs", "clave"],
  ])("bloquea datos de alto riesgo: %s", (text, kind) => {
    const r = scanPrivate(text);
    expect(r.kinds).toContain(kind);
    expect(r.block).toBe(true);
    expect(r.text).not.toMatch(/4111 1111|Secreta123|1\.020\.304\.050|456789|52987654|AIzaSy/);
  });
  it.each(["Busco unos Jordan 1 Low negros talla 42", "mi presupuesto es $ 3.500.000", "tengo 3500000 para gastar", "presupuesto de 2000000", "algo de 800 mil", "iPhone 15 Pro de 256 GB"])("no toca precios, tallas ni modelos: %s", (text) => {
    const r = scanPrivate(text);
    expect(r.kinds).toEqual([]);
    expect(r.text).toBe(text);
  });
  it("conserva el enlace pero quita la consulta (puede llevar tokens o correos)", () => {
    const r = scanPrivate("lo vi aquí https://www.nike.com/t/jordan-1-low?email=ana@x.co&token=abc");
    expect(r.text).toContain("https://www.nike.com/t/jordan-1-low");
    expect(r.text).not.toContain("token=");
    expect(r.urlCleaned).toBe(true);
    expect(r.block).toBe(false);
  });
});

describe("código de seguimiento BUS-XXXXXX", () => {
  it("6 símbolos del alfabeto sin confusos (sin 0, O, 1, I, L)", () => {
    for (let i = 0; i < 500; i++) expect(randomRequestCode()).toMatch(/^BUS-[23456789ABCDEFGHJKMNPQRSTUVWXYZ]{6}$/);
    expect(CODE_ALPHABET).not.toMatch(/[01OIL]/);
    expect(CODE_ALPHABET).toHaveLength(31);
  });
  it("descarta los bytes que sesgarían la distribución (≥ 248)", () => {
    const bytes = [255, 250, 248, 0, 1, 2, 3, 4, 5, 6, 7, 8];
    expect(randomRequestCode(() => Uint8Array.from(bytes))).toBe(`BUS-${[0, 1, 2, 3, 4, 5].map((b) => CODE_ALPHABET[b]).join("")}`);
  });
});

describe("configuración de presupuesto cero", () => {
  it("solo acepta modelos con nivel gratuito verificado", () => {
    expect(auraConfig({ GEMINI_API_KEY: "k", GEMINI_MODEL: "gemini-3.8-flash" } as any).enabled).toBe(true);
    expect(auraConfig({ GEMINI_API_KEY: "k", GEMINI_MODEL: "gemini-4-argon" } as any)).toMatchObject({ enabled: false, modelRejected: true });
    expect(auraConfig({ GEMINI_API_KEY: "k", GEMINI_MODEL: "gemini-3.1-pro-preview" } as any).enabled).toBe(false);
    expect(auraConfig({} as any).enabled).toBe(false);
    expect(auraConfig({ GEMINI_API_KEY: "k", AURA_ENABLED: "0" } as any).enabled).toBe(false);
  });
  it("clasifica los errores de Gemini sin reintentar", () => {
    expect(classify(new ApiError({ message: "x", status: 429 })).kind).toBe("quota");
    expect(classify(new Error("RESOURCE_EXHAUSTED: quota")).kind).toBe("quota");
    expect(classify(new ApiError({ message: "x", status: 503 })).kind).toBe("unavailable");
    const ctrl = new AbortController(); ctrl.abort();
    expect(classify(new Error("boom"), ctrl.signal).kind).toBe("timeout");
    expect(classify(new ApiError({ message: "x", status: 403 })).kind).toBe("error");
  });
});

// ── Base de datos falsa mínima para el chat ─────────────────────────────
function fakeDb(products: any[] = []) {
  const convs = new Map<string, any>();
  const messages: any[] = [];
  let n = 0;
  const db: any = {
    auraConversation: {
      findUnique: async ({ where }: any) => convs.get(where.id) ?? null,
      create: async ({ data }: any) => { const c = { id: `c${++n}`, messageCount: 0, status: "abierta", draft: null, request: null, ...data }; convs.set(c.id, c); return c; },
      update: async ({ where, data }: any) => { const c = convs.get(where.id); if (data.messageCount?.increment) c.messageCount += 1; if ("draft" in data) c.draft = data.draft; if (data.customerId) c.customerId = data.customerId; return c; },
    },
    auraMessage: {
      create: async ({ data }: any) => { messages.push({ createdAt: new Date(), errorKind: null, ...data }); return data; },
      findMany: async ({ where }: any) => messages.filter((m) => m.conversationId === where.conversationId && where.role.in.includes(m.role) && m.errorKind === null).map((m) => ({ role: m.role, text: m.text })),
    },
    product: { findMany: async () => products, findFirst: async () => products[0] ?? null },
  };
  return { db, convs, messages };
}
const cfg = { ...auraConfig({ GEMINI_API_KEY: "k" } as any) };
const viewer = { ip: "1.2.3.4", customerId: null };

function provider(impl: (o: ProviderRun) => Promise<any>): AiProvider & { seen: ProviderRun[] } {
  const seen: ProviderRun[] = [];
  return { id: "fake", seen, run: async (o) => { seen.push(o); return impl(o); } };
}

describe("POST /api/aura/chat (servicio)", () => {
  it("1-2. responde con datos del catálogo usando la herramienta, y avisa que es demostrativo", async () => {
    const { db } = fakeDb([{ slug: "nike-air-force", name: "Air Force 1", brand: "Nike", priceCOP: 539000, compareAtPriceCOP: null, images: ["https://x/img.jpg"], sizes: [], stock: 11, color: null, model: null, category: { slug: "calzado", label: "Calzado" }, variants: [{ size: "42", stock: 2 }, { size: "40", stock: 0 }] }]);
    const p = provider(async (o) => {
      const out: any = await o.execute({ name: "buscar_productos", args: { texto: "tenis nike", talla: "42" } });
      expect(out.nota).toMatch(/DEMOSTRATIVO/);
      expect(out.productos[0]).toMatchObject({ nombre: "Air Force 1", precio: expect.stringContaining("539"), tallas_con_existencias: ["42"] });
      return { text: "Tenemos los **Air Force 1** en talla 42 (catálogo de ejemplo).", tokensIn: 900, tokensOut: 40, calls: 2, toolsUsed: ["buscar_productos"] };
    });
    const r = await handleChat({ message: "busco tenis nike talla 42", attachments: 0 }, viewer, { db, config: cfg, provider: p });
    expect(r).toMatchObject({ source: "ia", state: "ok" });
    expect(r.products[0].slug).toBe("nike-air-force");
  });

  it("3. producto inexistente: la herramienta devuelve 0 resultados (no inventa)", async () => {
    const { db } = fakeDb([]);
    const t = createToolRunner({ catalogIsDemo: true }, db);
    expect(await t.execute({ name: "buscar_productos", args: { texto: "Garmin Fenix 8" } })).toMatchObject({ total: 0, productos: [] });
  });

  it("18. el correo y el celular escritos en el chat NUNCA llegan al modelo ni se guardan", async () => {
    const { db, messages } = fakeDb();
    const p = provider(async () => ({ text: "Gracias, no hace falta tu correo aquí.", tokensIn: 10, tokensOut: 5, calls: 1, toolsUsed: [] }));
    await handleChat({ message: "busco un iPhone, mi correo es ana@gmail.com y mi cel 3001234567", attachments: 0 }, viewer, { db, config: cfg, provider: p });
    const sent = JSON.stringify(p.seen[0].history) + p.seen[0].system;
    expect(sent).not.toMatch(/ana@gmail\.com|3001234567/);
    expect(JSON.stringify(messages)).not.toMatch(/ana@gmail\.com|3001234567/);
  });

  it("18b. una tarjeta o una clave bloquean el mensaje: no se llama al modelo", async () => {
    const { db } = fakeDb();
    const p = provider(async () => { throw new Error("no debería llamarse"); });
    const r = await handleChat({ message: "pago con 4111 1111 1111 1111", attachments: 0 }, viewer, { db, config: cfg, provider: p });
    expect(r).toMatchObject({ source: "sistema", state: "privacy" });
    expect(p.seen).toHaveLength(0);
  });

  it("8/19. las fotos no viajan: el modelo solo recibe un aviso de que hay adjuntos", async () => {
    const { db } = fakeDb();
    const p = provider(async () => ({ text: "Recibimos tus fotos; el equipo las revisará.", tokensIn: 10, tokensOut: 5, calls: 1, toolsUsed: [] }));
    await handleChat({ message: "te mando la foto", attachments: 2 }, viewer, { db, config: cfg, provider: p });
    const last = p.seen[0].history.at(-1)!;
    expect(last.text).toContain("adjuntó 2 archivo(s)");
    expect(JSON.stringify(p.seen[0])).not.toMatch(/base64|inlineData|image\//);
  });

  it("16. cuota gratuita agotada (429): mensaje fijo marcado como sistema, sin reintentar y con pausa", async () => {
    const { db } = fakeDb();
    const p = provider(async () => { throw new AiError("quota", "429", 429); });
    const r1 = await handleChat({ message: "hola", attachments: 0 }, viewer, { db, config: cfg, provider: p });
    expect(r1).toMatchObject({ source: "sistema", state: "quota", fallback: true });
    expect(r1.text).toMatch(/temporalmente limitada/);
    const r2 = await handleChat({ message: "hola de nuevo", attachments: 0 }, viewer, { db, config: cfg, provider: p });
    expect(r2.state).toBe("quota");
    expect(p.seen).toHaveLength(1); // la segunda vez ni se intentó
  });

  it("16b. el límite diario configurable detiene las llamadas antes de llegar a Google", async () => {
    const { db } = fakeDb();
    const p = provider(async (o) => { if (!(await o.beforeCall!())) throw new AiError("budget", "límite"); return { text: "ok", tokensIn: 1, tokensOut: 1, calls: 1, toolsUsed: [] }; });
    const small = { ...cfg, dailyCalls: 1, ipPerHour: 50, ipPerDay: 50 };
    expect((await handleChat({ message: "uno", attachments: 0 }, viewer, { db, config: small, provider: p })).state).toBe("ok");
    expect((await handleChat({ message: "dos", attachments: 0 }, viewer, { db, config: small, provider: p })).state).toBe("quota");
  });

  it("17. error o tiempo de espera de Gemini: respuesta fija y alternativa manual", async () => {
    const { db } = fakeDb();
    for (const kind of ["unavailable", "timeout", "error"] as const) {
      const r = await handleChat({ message: "hola", attachments: 0 }, viewer, { db, config: cfg, provider: provider(async () => { throw new AiError(kind, "x"); }) });
      expect(r).toMatchObject({ source: "sistema", state: "unavailable", fallback: true });
    }
  });

  it("sin clave configurada: no finge una respuesta de IA", async () => {
    const { db } = fakeDb();
    const r = await handleChat({ message: "hola", attachments: 0 }, viewer, { db, config: auraConfig({} as any), provider: null });
    expect(r).toMatchObject({ source: "sistema", state: "unconfigured" });
  });

  it("límite por IP y campo trampa contra robots", async () => {
    const { db } = fakeDb();
    const p = provider(async () => ({ text: "ok", tokensIn: 1, tokensOut: 1, calls: 1, toolsUsed: [] }));
    const tight = { ...cfg, ipPerHour: 2 };
    await handleChat({ message: "a", attachments: 0 }, viewer, { db, config: tight, provider: p });
    await handleChat({ message: "b", attachments: 0 }, viewer, { db, config: tight, provider: p });
    expect((await handleChat({ message: "c", attachments: 0 }, viewer, { db, config: tight, provider: p })).state).toBe("limit");
    expect((await handleChat({ message: "d", attachments: 0, website: "spam" }, { ip: "9.9.9.9", customerId: null }, { db, config: cfg, provider: p })).state).toBe("error");
  });

  it("12. una conversación ajena no se reutiliza (se abre otra nueva)", async () => {
    const { db, convs } = fakeDb();
    convs.set("ajena", { id: "ajena", customerId: "otro-cliente", ipHash: "x", messageCount: 0, status: "abierta" });
    const p = provider(async () => ({ text: "ok", tokensIn: 1, tokensOut: 1, calls: 1, toolsUsed: [] }));
    const r = await handleChat({ conversationId: "ajena", message: "muéstrame su solicitud", attachments: 0 }, { ip: "1.1.1.1", customerId: "yo" }, { db, config: cfg, provider: p });
    expect(r.conversationId).not.toBe("ajena");
  });
});

describe("herramientas: qué puede y qué no puede hacer el modelo", () => {
  it("20. solo existen 5 herramientas, ninguna administrativa", () => {
    expect(TOOL_SPECS.map((t) => t.name).sort()).toEqual(["buscar_productos", "consultar_politicas", "preparar_solicitud", "solicitar_atencion_humana", "ver_producto"]);
  });
  it("20b. una herramienta inventada (cambiar precio, aprobar compra) no hace nada", async () => {
    const t = createToolRunner({ catalogIsDemo: true }, fakeDb().db);
    expect(await t.execute({ name: "cambiar_precio", args: { slug: "x", precio: 1 } })).toEqual({ error: "Esa herramienta no existe." });
    expect(await t.execute({ name: "aprobar_cotizacion", args: {} })).toEqual({ error: "Esa herramienta no existe." });
  });
  it("5. políticas desde la fuente única (preguntas frecuentes)", async () => {
    const t = createToolRunner({ catalogIsDemo: true }, fakeDb().db);
    const r: any = await t.execute({ name: "consultar_politicas", args: { tema: "devoluciones" } });
    expect(r.texto.join(" ")).toMatch(/5 días hábiles/);
    expect(await t.execute({ name: "consultar_politicas", args: { tema: "inventado" } })).toHaveProperty("error");
  });
  it("6/7/10. preparar_solicitud solo deja un BORRADOR; los datos faltantes quedan pendientes", async () => {
    const t = createToolRunner({ catalogIsDemo: true }, fakeDb().db);
    const r: any = await t.execute({ name: "preparar_solicitud", args: { producto: "Nike Jordan negros", talla: "42", resumen: "Busca unos Jordan negros talla 42; no sabe el modelo exacto.", pendientes: ["modelo", "presupuesto"] } });
    expect(r.mensaje).toMatch(/AÚN NO existe/);
    expect(t.outputs.draft).toMatchObject({ producto: "Nike Jordan negros", talla: "42", modelo: null, pendientes: ["modelo", "presupuesto"], prioridad: "normal" });
    expect(await t.execute({ name: "preparar_solicitud", args: { producto: "x" } })).toHaveProperty("error");
  });
});

describe("confirmación de la solicitud (identidad solo en el servidor)", () => {
  const draft = { producto: "Nike Jordan negros", marca: "Nike", modelo: null, talla: "42", color: "negro", caracteristicas: null, presupuesto_cop: null, tienda_referencia: null, resumen: "Busca unos Jordan negros talla 42.", pendientes: ["modelo" as const], prioridad: "normal" as const };
  const customer: any = { id: "cu1", email: "ana@correo.co", name: "Ana Pérez", emailVerifiedAt: new Date() };
  const input = { conversationId: "c1", draft, links: ["https://www.nike.com/t/jordan"], consent: true as const };
  const dbWith = (conv: any) => ({ auraConversation: { findUnique: async () => conv, update: async () => conv }, auraMessage: { create: async () => ({}) } }) as any;

  it("10. crea la solicitud con el correo de la SESIÓN, canal aura y el resumen de AURA", async () => {
    const r = await confirmAuraRequest(input, [], { customer, ip: "1.2.3.4" }, dbWith({ id: "c1", customerId: "cu1", ipHash: "x", draft, request: null }));
    expect(r.code).toBe("BUS-ABC234");
    const [data, , owner, , aura] = created.calls[0] as any[];
    expect(data).toMatchObject({ email: "ana@correo.co", source: "aura", productName: "Nike Jordan negros", size: "42", links: ["https://www.nike.com/t/jordan"] });
    expect(owner).toBe("cu1");
    expect(aura).toMatchObject({ summary: draft.resumen, priority: "normal", conversationId: "c1" });
    expect(aura.pending).toContain("modelo");
  });
  it("exige correo verificado", async () => {
    await expect(confirmAuraRequest(input, [], { customer: { ...customer, emailVerifiedAt: null }, ip: "1" }, dbWith(null))).rejects.toBeInstanceOf(AuraRequestError);
  });
  it("12. no se puede confirmar la conversación de otra persona", async () => {
    await expect(confirmAuraRequest(input, [], { customer, ip: "1.2.3.4" }, dbWith({ id: "c1", customerId: "otro", ipHash: "x", draft, request: null }))).rejects.toMatchObject({ status: 404 });
    await expect(confirmAuraRequest(input, [], { customer, ip: "5.5.5.5" }, dbWith({ id: "c1", customerId: null, ipHash: ipHash("1.2.3.4"), draft, request: null }))).rejects.toMatchObject({ status: 404 });
  });
  it("sin borrador de AURA no se crea nada", async () => {
    await expect(confirmAuraRequest(input, [], { customer, ip: "1.2.3.4" }, dbWith({ id: "c1", customerId: "cu1", ipHash: "x", draft: null, request: null }))).rejects.toMatchObject({ status: 400 });
    expect(created.calls).toHaveLength(0);
  });
});

describe("respaldo gratuito cuando el modelo principal está saturado", () => {
  const ok = { text: "Hola, soy AURA.", tokensIn: 5, tokensOut: 5, calls: 1, toolsUsed: [] };
  it("ante 503 responde con el modelo de respaldo (una sola vez)", async () => {
    const { db } = fakeDb();
    const main = provider(async () => { throw new AiError("unavailable", "x", 503, "high demand"); });
    const backup = provider(async () => ok);
    const r = await handleChat({ message: "hola", attachments: 0 }, viewer, { db, config: cfg, provider: main, fallbackProvider: backup });
    expect(r).toMatchObject({ source: "ia", state: "ok", text: "Hola, soy AURA." });
    expect(backup.seen).toHaveLength(1);
  });
  it("no se usa ante cuota agotada ni tiempo agotado", async () => {
    for (const err of [new AiError("quota", "x", 429), new AiError("unavailable", "x", 504), new AiError("timeout", "x")]) {
      const { db } = fakeDb();
      setRateStore(new MemoryRateStore());
      const backup = provider(async () => ok);
      await handleChat({ message: "hola", attachments: 0 }, viewer, { db, config: cfg, provider: provider(async () => { throw err; }), fallbackProvider: backup });
      expect(backup.seen).toHaveLength(0);
    }
  });
  it("el respaldo solo puede ser un modelo gratuito; '0' lo desactiva", () => {
    expect(auraConfig({ GEMINI_API_KEY: "k" } as any).fallbackModel).toBe("gemini-3.6-flash");
    expect(auraConfig({ GEMINI_API_KEY: "k", AURA_FALLBACK_MODEL: "gemini-4-argon" } as any).fallbackModel).toBeNull();
    expect(auraConfig({ GEMINI_API_KEY: "k", AURA_FALLBACK_MODEL: "0" } as any).fallbackModel).toBeNull();
  });
});
