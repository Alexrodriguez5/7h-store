/**
 * Capa de proveedor de IA. AURA (herramientas, solicitudes, interfaz) no conoce a Google: habla con esta
 * interfaz. Hoy existe UNA implementación (Gemini, nivel gratuito). Cambiar de proveedor en el futuro es
 * escribir otra implementación de `AiProvider`, sin tocar el resto.
 */

export interface AuraTurn { role: "user" | "model"; text: string }

/** Herramienta descrita con JSON Schema (sin tipos propios de ningún proveedor). */
export interface ToolSpec { name: string; description: string; parameters: Record<string, unknown> }
export interface ToolCall { name: string; args: Record<string, unknown> }

export interface ProviderRun {
  system: string;
  history: AuraTurn[];
  tools: ToolSpec[];
  /** Ejecuta una herramienta en el servidor. Lo que devuelve es lo ÚNICO que el modelo ve de la base de datos. */
  execute: (call: ToolCall) => Promise<unknown>;
  /** Máximo de llamadas al modelo en este turno (cada ronda de herramientas cuenta una). */
  maxCalls: number;
  signal: AbortSignal;
  /** Se llama antes de cada llamada al modelo: permite descontar la cuota diaria. Si devuelve false, se detiene. */
  beforeCall?: () => Promise<boolean>;
}

export interface ProviderResult { text: string; tokensIn: number; tokensOut: number; calls: number; toolsUsed: string[] }

export interface AiProvider {
  readonly id: string;
  run(opts: ProviderRun): Promise<ProviderResult>;
}

export type AiErrorKind = "quota" | "unavailable" | "timeout" | "error" | "budget";

/** Error del proveedor ya clasificado. El mensaje nunca incluye la clave ni el contenido enviado. */
export class AiError extends Error {
  constructor(public kind: AiErrorKind, message: string, public status?: number) { super(message); }
}
