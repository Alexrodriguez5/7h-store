import type { AuraConfig } from "./config";
import { geminiProvider } from "./gemini";
import { ollamaProvider } from "./ollama";
import type { AiProvider } from "./provider";

/**
 * Elige el proveedor principal y su respaldo según la configuración:
 * - AURA_PROVIDER=gemini (predeterminado): Gemini principal y otro modelo Flash gratuito de respaldo.
 * - AURA_PROVIDER=ollama: Ollama principal y Gemini (modelo principal gratuito) de respaldo, si hay clave.
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
    return { primary, backup: gemini(cfg.model) };
  }
  const primary = gemini(cfg.model);
  return { primary, backup: primary ? gemini(cfg.fallbackModel) : null };
}
