import type { AuraConfig } from "./config";
import { geminiProvider } from "./gemini";
import { ollamaProvider } from "./ollama";
import { AiError, type AiProvider } from "./provider";

/**
 * Elige el proveedor principal y su respaldo según la configuración:
 * - AURA_PROVIDER=gemini (predeterminado): Gemini principal y otro modelo Flash gratuito de respaldo.
 * - AURA_PROVIDER=ollama: Ollama principal y, de respaldo, los dos Flash gratuitos de Gemini en cadena
 *   (el principal de Gemini suele responder 503/504 por alta demanda).
 * Nunca combina con proveedores de pago: Ollama Cloud solo se acepta con OLLAMA_ALLOW_PAID=1 (config.ts).
 */
export function buildProviders(cfg: AuraConfig): { primary: AiProvider | null; backup: AiProvider | null } {
  if (!cfg.enabled) return { primary: null, backup: null };
  const gemini = (model: string | null) => (cfg.key && model ? geminiProvider(cfg.key, model, cfg.timeoutMs) : null);
  if (cfg.provider === "ollama" && cfg.ollama.baseUrl) {
    const primary = ollamaProvider({
      baseUrl: cfg.ollama.baseUrl,
      model: cfg.ollama.model,
      apiKey: cfg.ollama.apiKey,
      timeoutMs: Math.min(cfg.ollama.timeoutMs, cfg.timeoutMs - 3_000),
      keepAlive: cfg.ollama.keepAlive,
      numCtx: cfg.ollama.numCtx,
    });
    // Primero el Flash alterno: en las pruebas del 16-11-2026 respondió en ~2 s mientras el principal agotaba
    // la espera (504). Si el alterno está desactivado, queda solo el principal.
    return { primary, backup: chain(gemini(cfg.fallbackModel), gemini(cfg.model)) };
  }
  const primary = gemini(cfg.model);
  return { primary, backup: primary ? gemini(cfg.fallbackModel) : null };
}

/** Prueba `a` y, solo si está saturado o caído ("unavailable") y el turno no se canceló, prueba `b`. */
export function chain(a: AiProvider | null, b: AiProvider | null): AiProvider | null {
  if (!a || !b) return a ?? b;
  return {
    id: `${a.id}→${b.id}`,
    async run(opts) {
      try {
        return await a.run(opts);
      } catch (e) {
        if (!(e instanceof AiError) || e.kind !== "unavailable" || opts.signal.aborted) throw e;
        return b.run(opts);
      }
    },
  };
}
