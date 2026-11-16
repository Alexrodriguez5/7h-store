import { describe, expect, it, vi } from "vitest";
import { auraConfig, ollamaConfig } from "@/lib/aura/config";
import { ollamaProvider } from "@/lib/aura/ollama";
import { buildProviders } from "@/lib/aura/providers";
import { AiError, type ProviderRun } from "@/lib/aura/provider";

const env = (o: Record<string, string>) => o as unknown as NodeJS.ProcessEnv;
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

const baseRun = (over: Partial<ProviderRun> = {}): ProviderRun => ({
  system: "sistema",
  history: [{ role: "user", text: "hola" }],
  tools: [{ name: "buscar_productos", description: "Busca", parameters: { type: "object", properties: {} } }],
  execute: async () => ({ productos: [] }),
  maxCalls: 3,
  signal: new AbortController().signal,
  ...over,
});

describe("ollamaConfig: seguridad y costo", () => {
  it("acepta localhost por http y exige modelo", () => {
    expect(ollamaConfig(env({ OLLAMA_BASE_URL: "http://127.0.0.1:11434", OLLAMA_MODEL: "qwen3.5:4b" })).ready).toBe(true);
    expect(ollamaConfig(env({ OLLAMA_BASE_URL: "http://127.0.0.1:11434" })).ready).toBe(false);
  });
  it("rechaza http fuera de localhost", () => {
    const c = ollamaConfig(env({ OLLAMA_BASE_URL: "http://mi-servidor.com", OLLAMA_MODEL: "qwen3.5:4b" }));
    expect(c.ready).toBe(false);
    expect(c.reason).toMatch(/HTTPS/);
  });
  it("bloquea Ollama Cloud (de pago) salvo autorización explícita", () => {
    expect(ollamaConfig(env({ OLLAMA_BASE_URL: "https://ollama.com", OLLAMA_MODEL: "qwen3.5:4b" })).ready).toBe(false);
    expect(ollamaConfig(env({ OLLAMA_BASE_URL: "https://ollama.com", OLLAMA_MODEL: "qwen3.5:4b", OLLAMA_ALLOW_PAID: "1" })).ready).toBe(true);
  });
  it("el motivo nunca incluye la dirección ni la clave", () => {
    const c = ollamaConfig(env({ OLLAMA_BASE_URL: "http://secreto.interno.example", OLLAMA_MODEL: "m", OLLAMA_API_KEY: "clave-123" }));
    expect(c.reason).not.toMatch(/secreto|clave-123/);
  });
});

describe("auraConfig + buildProviders", () => {
  it("por defecto sigue con Gemini (producción no cambia)", () => {
    const cfg = auraConfig(env({ GEMINI_API_KEY: "k", OLLAMA_BASE_URL: "http://localhost:11434", OLLAMA_MODEL: "qwen3.5:4b" }));
    expect(cfg.provider).toBe("gemini");
    const p = buildProviders(cfg);
    expect(p.primary?.id).toMatch(/^gemini:/);
    expect(p.backup?.id).toMatch(/^gemini:/);
  });
  it("AURA_PROVIDER=ollama: Ollama principal y Gemini de respaldo", () => {
    const cfg = auraConfig(env({ AURA_PROVIDER: "ollama", GEMINI_API_KEY: "k", OLLAMA_BASE_URL: "http://localhost:11434", OLLAMA_MODEL: "qwen3.5:4b" }));
    expect(cfg.enabled).toBe(true);
    const p = buildProviders(cfg);
    expect(p.primary?.id).toBe("ollama:qwen3.5:4b");
    expect(p.backup?.id).toMatch(/^gemini:/);
  });
  it("Ollama sin Gemini funciona sin respaldo", () => {
    const cfg = auraConfig(env({ AURA_PROVIDER: "ollama", OLLAMA_BASE_URL: "http://localhost:11434", OLLAMA_MODEL: "qwen3.5:4b" }));
    expect(cfg.enabled).toBe(true);
    expect(buildProviders(cfg).backup).toBeNull();
  });
  it("si Ollama está mal configurado vuelve a Gemini", () => {
    const cfg = auraConfig(env({ AURA_PROVIDER: "ollama", GEMINI_API_KEY: "k", OLLAMA_BASE_URL: "http://remoto.example", OLLAMA_MODEL: "x" }));
    expect(cfg.provider).toBe("gemini");
  });
  it("AURA_ENABLED=0 apaga todo", () => {
    const cfg = auraConfig(env({ AURA_ENABLED: "0", AURA_PROVIDER: "ollama", OLLAMA_BASE_URL: "http://localhost:11434", OLLAMA_MODEL: "m" }));
    expect(buildProviders(cfg).primary).toBeNull();
  });
});

describe("ollamaProvider", () => {
  it("responde texto y suma tokens", async () => {
    const fetchImpl = vi.fn(async () => json({ message: { role: "assistant", content: " Hola " }, prompt_eval_count: 10, eval_count: 4 }));
    const p = ollamaProvider({ baseUrl: "http://localhost:11434/", model: "m", timeoutMs: 5000, fetchImpl });
    const r = await p.run(baseRun());
    expect(r).toMatchObject({ text: "Hola", tokensIn: 10, tokensOut: 4, calls: 1 });
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("http://localhost:11434/api/chat");
    const body = JSON.parse(String(init.body));
    expect(body.stream).toBe(false);
    expect(body.messages[0]).toEqual({ role: "system", content: "sistema" });
    expect(body.tools[0].function.name).toBe("buscar_productos");
    expect((init.headers as Record<string, string>).Authorization).toBeUndefined();
  });

  it("ejecuta herramientas y devuelve el resultado al modelo", async () => {
    const execute = vi.fn(async () => ({ total: 1 }));
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(json({ message: { role: "assistant", content: "", tool_calls: [{ function: { name: "buscar_productos", arguments: { texto: "tenis" } } }] } }))
      .mockResolvedValueOnce(json({ message: { role: "assistant", content: "Encontré uno." } }));
    const p = ollamaProvider({ baseUrl: "http://localhost:11434", model: "m", apiKey: "tok", timeoutMs: 5000, fetchImpl });
    const r = await p.run(baseRun({ execute }));
    expect(execute).toHaveBeenCalledWith({ name: "buscar_productos", args: { texto: "tenis" } });
    expect(r.text).toBe("Encontré uno.");
    expect(r.toolsUsed).toEqual(["buscar_productos"]);
    const second = JSON.parse(String((fetchImpl.mock.calls[1] as unknown as [string, RequestInit])[1].body));
    expect(second.messages.at(-1)).toMatchObject({ role: "tool", tool_name: "buscar_productos" });
    expect(((fetchImpl.mock.calls[0] as unknown as [string, RequestInit])[1].headers as Record<string, string>).Authorization).toBe("Bearer tok");
  });

  it("acepta argumentos en texto JSON y descarta los inválidos", async () => {
    const execute = vi.fn(async () => ({}));
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(json({ message: { content: "", tool_calls: [{ function: { name: "a", arguments: "{\"x\":1}" } }, { function: { name: "b", arguments: "no-json" } }] } }))
      .mockResolvedValueOnce(json({ message: { content: "ok" } }));
    await ollamaProvider({ baseUrl: "http://localhost:11434", model: "m", timeoutMs: 5000, fetchImpl }).run(baseRun({ execute }));
    expect(execute).toHaveBeenNthCalledWith(1, { name: "a", args: { x: 1 } });
    expect(execute).toHaveBeenNthCalledWith(2, { name: "b", args: {} });
  });

  it("clasifica las fallas como 'unavailable' para pasar al respaldo", async () => {
    for (const fetchImpl of [
      vi.fn(async () => { throw new TypeError("fetch failed"); }),
      vi.fn(async () => json({ error: "model not found" }, 404)),
      vi.fn(async () => json({ error: "busy" }, 503)),
      vi.fn(async () => json({ error: "limit" }, 429)),
    ]) {
      const err = await ollamaProvider({ baseUrl: "http://localhost:11434", model: "m", timeoutMs: 5000, fetchImpl: fetchImpl as unknown as typeof fetch }).run(baseRun()).catch((e) => e);
      expect(err).toBeInstanceOf(AiError);
      expect((err as AiError).kind).toBe("unavailable");
    }
  });

  it("su propio tiempo máximo es 'unavailable'; el del turno es 'timeout'", async () => {
    const hang = (_u: unknown, init?: RequestInit) => new Promise<Response>((_, rej) => init?.signal?.addEventListener("abort", () => rej(new DOMException("aborted", "AbortError"))));
    const own = await ollamaProvider({ baseUrl: "http://localhost:11434", model: "m", timeoutMs: 30, fetchImpl: hang as typeof fetch }).run(baseRun()).catch((e) => e);
    expect((own as AiError).kind).toBe("unavailable");
    const ctrl = new AbortController();
    setTimeout(() => ctrl.abort(), 20);
    const turn = await ollamaProvider({ baseUrl: "http://localhost:11434", model: "m", timeoutMs: 5000, fetchImpl: hang as typeof fetch }).run(baseRun({ signal: ctrl.signal })).catch((e) => e);
    expect((turn as AiError).kind).toBe("timeout");
  });

  it("respeta el límite diario (beforeCall)", async () => {
    const fetchImpl = vi.fn();
    const err = await ollamaProvider({ baseUrl: "http://localhost:11434", model: "m", timeoutMs: 5000, fetchImpl }).run(baseRun({ beforeCall: async () => false })).catch((e) => e);
    expect((err as AiError).kind).toBe("budget");
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("el detalle del error no filtra el token", async () => {
    const fetchImpl = vi.fn(async () => new Response("invalid Bearer abc123", { status: 401 }));
    const err = (await ollamaProvider({ baseUrl: "http://localhost:11434", model: "m", apiKey: "abc123", timeoutMs: 5000, fetchImpl }).run(baseRun()).catch((e) => e)) as AiError;
    expect(err.detail).not.toContain("abc123");
  });
});
