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
  return {
    key,
    model,
    fallbackModel,
    /** "0" la apaga sin borrar la clave (interruptor de emergencia). */
    enabled: env.AURA_ENABLED !== "0" && !!key && !!model,
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
