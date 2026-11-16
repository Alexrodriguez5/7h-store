/**
 * Configuración de AURA (solo servidor). La clave NUNCA lleva prefijo NEXT_PUBLIC y no se registra en logs.
 *
 * Presupuesto cero: solo se aceptan modelos verificados con nivel gratuito en la documentación de Google
 * (aistudio.google.com/docs/pricing, revisado el 7 de noviembre de 2026). Cualquier otro valor de
 * GEMINI_MODEL deja AURA apagada en vez de usar un modelo que pueda cobrar.
 */
/** El primero es el predeterminado. Los otros dos también tienen nivel gratuito y sirven de respaldo manual (GEMINI_MODEL). */
export const AURA_FREE_MODELS = ["gemini-3.8-flash", "gemini-3.6-flash", "gemini-3.5-flash-lite"] as const;

const int = (v: string | undefined, fallback: number, min: number, max: number) => {
  const n = Number.parseInt(v ?? "", 10);
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback;
};

export function auraConfig(env: NodeJS.ProcessEnv = process.env) {
  const key = env.GEMINI_API_KEY?.trim() || null;
  const requested = env.GEMINI_MODEL?.trim() || AURA_FREE_MODELS[0];
  const model = (AURA_FREE_MODELS as readonly string[]).includes(requested) ? requested : null;
  // Respaldo automático cuando el principal está saturado (también con nivel gratuito). "0" lo desactiva.
  const fb = env.AURA_FALLBACK_MODEL?.trim() || "gemini-3.6-flash";
  const fallbackModel = fb !== "0" && fb !== model && (AURA_FREE_MODELS as readonly string[]).includes(fb) ? fb : null;
  const ollama = ollamaConfig(env);
  // "gemini" (predeterminado: lo que hay hoy en producción) u "ollama" (Ollama principal y Gemini de respaldo).
  const provider: "gemini" | "ollama" = env.AURA_PROVIDER?.trim().toLowerCase() === "ollama" && ollama.ready ? "ollama" : "gemini";
  const geminiReady = !!key && !!model;
  return {
    key,
    model,
    fallbackModel,
    provider,
    ollama,
    /** "0" la apaga sin borrar la clave (interruptor de emergencia). */
    enabled: env.AURA_ENABLED !== "0" && (geminiReady || provider === "ollama"),
    modelRejected: !model,
    /** Llamadas al modelo por día en toda la tienda (cada mensaje puede usar hasta 3 por las herramientas). */
    dailyCalls: int(env.AURA_DAILY_LIMIT, 150, 1, 5000),
    ipPerHour: int(env.AURA_IP_HOURLY, 20, 1, 500),
    ipPerDay: int(env.AURA_IP_DAILY, 60, 1, 2000),
    messagesPerConversation: int(env.AURA_MAX_MESSAGES, 24, 4, 200),
    /** Mientras el catálogo sea demostrativo, AURA lo dice siempre que muestre productos. */
    catalogIsDemo: env.AURA_CATALOG_IS_DEMO !== "0",
    /** Tiempo máximo de espera por respuesta del modelo. */
    timeoutMs: int(env.AURA_TIMEOUT_MS, 20_000, 5_000, 45_000),
  };
}
export type AuraConfig = ReturnType<typeof auraConfig>;

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]", "::1"]);

/**
 * Ollama (solo servidor). Reglas de seguridad y costo:
 * - Fuera de localhost exige HTTPS (la clave no viaja en claro y el puerto 11434 nunca se expone directo).
 * - Ollama Cloud (ollama.com) cobra por token: queda bloqueado salvo OLLAMA_ALLOW_PAID=1, que solo
 *   debe activarse con autorización expresa del dueño.
 * - `reason` explica por qué no está listo, sin incluir la dirección ni la clave.
 */
export function ollamaConfig(env: NodeJS.ProcessEnv = process.env) {
  const raw = env.OLLAMA_BASE_URL?.trim() || "";
  const model = env.OLLAMA_MODEL?.trim() || "";
  const apiKey = env.OLLAMA_API_KEY?.trim() || null;
  let baseUrl: string | null = null;
  let reason: string | null = null;
  if (!raw) reason = "Falta OLLAMA_BASE_URL";
  else if (!/^[\w.:-]{1,100}$/.test(model)) reason = "Falta OLLAMA_MODEL o no es válido";
  else {
    try {
      const u = new URL(raw);
      const local = LOCAL_HOSTS.has(u.hostname);
      const paid = u.hostname === "ollama.com" || u.hostname.endsWith(".ollama.com");
      if (u.protocol !== "https:" && !(local && u.protocol === "http:")) reason = "OLLAMA_BASE_URL debe usar HTTPS fuera de localhost";
      else if (paid && env.OLLAMA_ALLOW_PAID !== "1") reason = "Ollama Cloud es de pago: requiere OLLAMA_ALLOW_PAID=1 con autorización";
      else baseUrl = `${u.origin}${u.pathname.replace(/\/+$/, "")}`;
    } catch {
      reason = "OLLAMA_BASE_URL no es una dirección válida";
    }
  }
  return {
    ready: !!baseUrl,
    reason,
    baseUrl,
    model,
    apiKey,
    /** Tiempo propio de Ollama, menor que el del turno, para dejar margen al respaldo. */
    timeoutMs: int(env.OLLAMA_TIMEOUT_MS, 12_000, 2_000, 40_000),
    keepAlive: /^\d{1,4}[smh]$|^-1$/.test(env.OLLAMA_KEEP_ALIVE?.trim() ?? "") ? env.OLLAMA_KEEP_ALIVE!.trim() : "10m",
    numCtx: int(env.OLLAMA_NUM_CTX, 8192, 2048, 32768),
  };
}
