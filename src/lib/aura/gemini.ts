import { ApiError, GoogleGenAI, ThinkingLevel, type Content, type Part } from "@google/genai";
import { AiError, type AiProvider, type ProviderRun } from "./provider";

/**
 * Implementación con Google Gemini (SDK oficial @google/genai), pensada para el NIVEL GRATUITO:
 * - Sin reintentos automáticos (attempts: 1): un 429 no se repite en bucle.
 * - Tiempo máximo por llamada y señal de cancelación.
 * - Pensamiento en nivel bajo y respuesta corta: menos tokens por minuto, menos riesgo de agotar la cuota.
 * - Nunca cambia de modelo ni de proveedor por su cuenta.
 */
export function geminiProvider(apiKey: string, model: string, timeoutMs: number): AiProvider {
  const ai = new GoogleGenAI({ apiKey, httpOptions: { timeout: timeoutMs, retryOptions: { attempts: 1 } } });
  return {
    id: `gemini:${model}`,
    async run({ system, history, tools, execute, maxCalls, signal, beforeCall }: ProviderRun) {
      const contents: Content[] = history.map((t) => ({ role: t.role, parts: [{ text: t.text }] }));
      const declarations = tools.map((t) => ({ name: t.name, description: t.description, parametersJsonSchema: t.parameters }));
      let tokensIn = 0, tokensOut = 0, calls = 0;
      const toolsUsed: string[] = [];

      while (calls < maxCalls) {
        if (beforeCall && !(await beforeCall())) throw new AiError("budget", "Límite diario de AURA alcanzado");
        calls++;
        let res;
        try {
          res = await ai.models.generateContent({
            model,
            contents,
            config: {
              systemInstruction: system,
              tools: [{ functionDeclarations: declarations }],
              thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
              maxOutputTokens: 1024,
              abortSignal: signal,
            },
          });
        } catch (e) {
          throw classify(e, signal);
        }
        const u = res.usageMetadata;
        tokensIn += u?.promptTokenCount ?? 0;
        tokensOut += (u?.candidatesTokenCount ?? 0) + (u?.thoughtsTokenCount ?? 0);

        const fnCalls = res.functionCalls ?? [];
        if (!fnCalls.length) return { text: (res.text ?? "").trim(), tokensIn, tokensOut, calls, toolsUsed };

        // Se devuelve el turno del modelo TAL CUAL (incluye las firmas de pensamiento de Gemini 3).
        const modelTurn = res.candidates?.[0]?.content;
        if (modelTurn) contents.push(modelTurn);
        const parts: Part[] = [];
        for (const c of fnCalls.slice(0, 4)) {
          const name = c.name ?? "";
          toolsUsed.push(name);
          let result: unknown;
          try {
            result = await execute({ name, args: (c.args ?? {}) as Record<string, unknown> });
          } catch {
            result = { error: "La herramienta no está disponible ahora." };
          }
          parts.push({ functionResponse: { id: c.id, name, response: { result } } });
        }
        contents.push({ role: "user", parts });
      }
      throw new AiError("error", "Demasiadas rondas de herramientas en un turno");
    },
  };
}

/** Traduce errores del SDK a categorías. No se copia el cuerpo del error (podría incluir el contenido). */
export function classify(e: unknown, signal?: AbortSignal): AiError {
  if (e instanceof AiError) return e;
  if (signal?.aborted || (e instanceof Error && (e.name === "AbortError" || /timed? ?out|aborted/i.test(e.message)))) return new AiError("timeout", "Tiempo de espera agotado");
  const status = e instanceof ApiError ? e.status : typeof (e as { status?: unknown })?.status === "number" ? (e as { status: number }).status : undefined;
  const msg = e instanceof Error ? e.message : "";
  // Solo el motivo del proveedor (sin contenido enviado); se borra cualquier cosa parecida a una clave.
  const detail = (msg.match(/"message":\s*"([^"]{0,200})/)?.[1] ?? msg.slice(0, 160)).replace(/AIza[0-9A-Za-z_-]{20,}|key=[^&\s]+/g, "[oculto]");
  if (status === 429 || /RESOURCE_EXHAUSTED|quota|rate limit/i.test(msg)) {
    // Google indica cuánto esperar (RetryInfo.retryDelay, p. ej. "37s"): el límite por minuto se libera pronto.
    const retry = Number(msg.match(/"retryDelay":\s*"(\d+(?:\.\d+)?)s"/)?.[1] ?? NaN);
    return new AiError("quota", "Cuota gratuita agotada", 429, detail, Number.isFinite(retry) ? Math.ceil(retry) : undefined);
  }
  if (status === 500 || status === 502 || status === 503 || status === 504 || /UNAVAILABLE|overloaded/i.test(msg)) return new AiError("unavailable", "Servicio de IA no disponible", status, detail);
  if (status === 401 || status === 403) return new AiError("error", "Clave de Gemini no válida o sin permiso", status, detail);
  return new AiError("error", "Error del proveedor de IA", status, detail);
}
