import { AiError, type AiProvider, type ProviderRun } from "./provider";

/**
 * Implementación con Ollama (`POST /api/chat`), sin dependencias: sirve para Ollama local, un servidor
 * propio detrás de HTTPS o Ollama Cloud, porque la API es la misma. Solo se usa desde el servidor.
 *
 * - Sin streaming en esta versión: respuesta completa, igual que Gemini, para no cambiar el widget.
 * - Tiempo máximo PROPIO (más corto que el del turno) para que, si Ollama tarda, quede tiempo para el respaldo.
 * - Cualquier falla de Ollama (caído, lento, saturado o sin cuota) se clasifica como "unavailable":
 *   así chat.ts pasa al respaldo (Gemini) y no aplica la pausa de cuota, que es solo de Gemini.
 * - Nunca registra la clave, la dirección completa ni el contenido enviado.
 */
export interface OllamaOptions {
  baseUrl: string;
  model: string;
  apiKey?: string | null;
  timeoutMs: number;
  keepAlive?: string;
  numCtx?: number;
  fetchImpl?: typeof fetch;
}

interface OllamaMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string;
  tool_calls?: { function: { name: string; arguments: Record<string, unknown> | string } }[];
  tool_name?: string;
}

interface OllamaChatResponse {
  message?: OllamaMessage;
  prompt_eval_count?: number;
  eval_count?: number;
  error?: string;
}

export function ollamaProvider(o: OllamaOptions): AiProvider {
  const doFetch = o.fetchImpl ?? fetch;
  const url = `${o.baseUrl.replace(/\/+$/, "")}/api/chat`;
  return {
    id: `ollama:${o.model}`,
    async run({ system, history, tools, execute, maxCalls, signal, beforeCall }: ProviderRun) {
      const messages: OllamaMessage[] = [
        { role: "system", content: system },
        ...history.map((t) => ({ role: t.role === "model" ? ("assistant" as const) : ("user" as const), content: t.text })),
      ];
      const toolDefs = tools.map((t) => ({ type: "function", function: { name: t.name, description: t.description, parameters: t.parameters } }));
      let tokensIn = 0, tokensOut = 0, calls = 0;
      const toolsUsed: string[] = [];

      while (calls < maxCalls) {
        if (beforeCall && !(await beforeCall())) throw new AiError("budget", "Límite diario de AURA alcanzado");
        calls++;
        const data = await post(doFetch, url, o, signal, {
          model: o.model,
          messages,
          tools: toolDefs,
          stream: false,
          think: false,
          keep_alive: o.keepAlive ?? "10m",
          options: { temperature: 0.3, num_predict: 1024, ...(o.numCtx ? { num_ctx: o.numCtx } : {}) },
        });
        tokensIn += data.prompt_eval_count ?? 0;
        tokensOut += data.eval_count ?? 0;
        const msg = data.message;
        const fnCalls = msg?.tool_calls ?? [];
        if (!fnCalls.length) return { text: (msg?.content ?? "").trim(), tokensIn, tokensOut, calls, toolsUsed };

        messages.push({ role: "assistant", content: msg?.content ?? "", tool_calls: fnCalls });
        for (const c of fnCalls.slice(0, 4)) {
          const name = c.function?.name ?? "";
          toolsUsed.push(name);
          let result: unknown;
          try {
            result = await execute({ name, args: parseArgs(c.function?.arguments) });
          } catch {
            result = { error: "La herramienta no está disponible ahora." };
          }
          messages.push({ role: "tool", tool_name: name, content: JSON.stringify({ result }) });
        }
      }
      throw new AiError("error", "Demasiadas rondas de herramientas en un turno");
    },
  };
}

function parseArgs(a: unknown): Record<string, unknown> {
  if (a && typeof a === "object" && !Array.isArray(a)) return a as Record<string, unknown>;
  if (typeof a === "string") {
    try {
      const v = JSON.parse(a);
      return v && typeof v === "object" && !Array.isArray(v) ? v : {};
    } catch {
      return {};
    }
  }
  return {};
}

async function post(doFetch: typeof fetch, url: string, o: OllamaOptions, turnSignal: AbortSignal, body: unknown): Promise<OllamaChatResponse> {
  const own = AbortSignal.timeout(o.timeoutMs);
  const signal = AbortSignal.any([turnSignal, own]);
  let res: Response;
  try {
    res = await doFetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(o.apiKey ? { Authorization: `Bearer ${o.apiKey}` } : {}) },
      body: JSON.stringify(body),
      signal,
    });
  } catch (e) {
    if (turnSignal.aborted) throw new AiError("timeout", "Tiempo de espera agotado");
    if (own.aborted) throw new AiError("unavailable", "Ollama tardó demasiado", undefined, "tiempo de espera propio agotado");
    throw new AiError("unavailable", "Ollama no responde", undefined, e instanceof Error ? e.name : "conexión fallida");
  }
  if (!res.ok) {
    // Solo el motivo corto del proveedor, sin claves.
    const detail = (await res.text().catch(() => "")).slice(0, 160).replace(/Bearer\s+\S+/gi, "[oculto]");
    if (res.status === 401 || res.status === 403) throw new AiError("unavailable", "Ollama rechazó la autenticación", res.status, detail);
    if (res.status === 404) throw new AiError("unavailable", "Modelo de Ollama no instalado", res.status, detail);
    // Un 504 de Ollama (o de su proxy) no agota el tiempo del turno: se omite el código para que chat.ts intente el respaldo.
    throw new AiError("unavailable", "Ollama no disponible", res.status === 504 ? undefined : res.status, detail);
  }
  try {
    const data = (await res.json()) as OllamaChatResponse;
    if (data.error) throw new AiError("unavailable", "Ollama devolvió un error", res.status, data.error.slice(0, 160));
    return data;
  } catch (e) {
    if (e instanceof AiError) throw e;
    throw new AiError("unavailable", "Respuesta de Ollama no válida");
  }
}
