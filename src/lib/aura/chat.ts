import { createHash } from "node:crypto";
import type { Prisma, PrismaClient } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { consume, isBlocked, MIN, registerHit } from "@/lib/rate-limit";
import { auraConfig, type AuraConfig } from "./config";
import { geminiProvider } from "./gemini";
import { describeKinds, scanPrivate, type PrivateKind } from "./privacy";
import { systemPrompt } from "./prompt";
import { AiError, type AiProvider, type AuraTurn } from "./provider";
import { createToolRunner, TOOL_SPECS, type Handoff, type ProductCard, type RequestDraft } from "./tools";

export const chatInput = z.object({
  conversationId: z.string().trim().max(40).nullish(),
  message: z.string().trim().min(1, "Escribe tu mensaje").max(1200, "El mensaje es muy largo (máximo 1.200 caracteres)."),
  /** Cuántos archivos tiene adjuntos el cliente (los archivos NO viajan aquí ni al modelo). */
  attachments: z.number().int().min(0).max(8).default(0),
  /** Campo trampa para robots: una persona nunca lo llena. */
  website: z.string().max(200).optional(),
});
export type ChatInput = z.infer<typeof chatInput>;

/**
 * Respuesta para la interfaz. `source` dice la verdad sobre quién respondió:
 * "ia" = Gemini; "sistema" = texto fijo de la aplicación (límites, privacidad, errores). Nunca se presenta
 * un texto fijo como si fuera de la IA.
 */
export interface ChatReply {
  conversationId: string | null;
  source: "ia" | "sistema";
  text: string;
  state: "ok" | "privacy" | "quota" | "limit" | "unavailable" | "unconfigured" | "error";
  products: ProductCard[];
  draft: RequestDraft | null;
  handoff: Handoff | null;
  privacy: PrivateKind[];
  /** Mostrar el asistente guiado como alternativa manual. */
  fallback: boolean;
}

const sys = (state: ChatReply["state"], text: string, conversationId: string | null, extra: Partial<ChatReply> = {}): ChatReply =>
  ({ conversationId, source: "sistema", text, state, products: [], draft: null, handoff: null, privacy: [], fallback: state !== "privacy", ...extra });

export const ipHash = (ip: string) => createHash("sha256").update(`aura:${ip}`).digest("hex").slice(0, 32);

/** Día según la hora del Pacífico: la cuota diaria de Google se reinicia a medianoche de Los Ángeles. */
export const pacificDay = (now = new Date()) => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Los_Angeles" }).format(now);

const COOLDOWN_KEY = "aura:quota-cooldown";
/** Mientras exista, el modelo principal se considera saturado y se va directo al respaldo gratuito. */
const PRIMARY_BUSY_KEY = "aura:primary-busy";

export interface ChatDeps { db?: PrismaClient; config?: AuraConfig; provider?: AiProvider | null; fallbackProvider?: AiProvider | null; now?: Date }

export async function handleChat(input: ChatInput, viewer: { ip: string; customerId: string | null }, deps: ChatDeps = {}): Promise<ChatReply> {
  const db = deps.db ?? prisma;
  const cfg = deps.config ?? auraConfig();
  const ih = ipHash(viewer.ip);

  if (input.website) return sys("error", "No pudimos procesar el mensaje.", null, { fallback: false });

  // 1) Límites por IP (antes de cualquier otra cosa: protegen la cuota gratuita del abuso).
  const hour = await consume(`aura:ip:h:${ih}`, cfg.ipPerHour, 60 * MIN);
  const day = await consume(`aura:ip:d:${ih}`, cfg.ipPerDay, 24 * 60 * MIN);
  if (!hour.allowed || !day.allowed) return sys("limit", "Enviaste muchos mensajes seguidos. Espera un rato o usa el asistente guiado para registrar tu búsqueda.", input.conversationId ?? null);

  // 2) Conversación: se reutiliza solo si es de este cliente (o de esta misma conexión, si no hay sesión).
  let conv = input.conversationId ? await db.auraConversation.findUnique({ where: { id: input.conversationId }, select: { id: true, customerId: true, ipHash: true, messageCount: true, status: true } }) : null;
  if (conv && !(conv.customerId ? conv.customerId === viewer.customerId : conv.ipHash === ih || !!viewer.customerId)) conv = null;
  if (conv && !conv.customerId && viewer.customerId) await db.auraConversation.update({ where: { id: conv.id }, data: { customerId: viewer.customerId } });
  if (!conv) conv = await db.auraConversation.create({ data: { customerId: viewer.customerId, ipHash: ih }, select: { id: true, customerId: true, ipHash: true, messageCount: true, status: true } });
  const cid = conv.id;

  if (conv.messageCount >= cfg.messagesPerConversation) return sys("limit", "Esta conversación llegó a su límite de mensajes. Puedes empezar una nueva o registrar tu búsqueda con el asistente guiado.", cid);

  // 3) Privacidad: lo que se guarda y lo que puede ver el modelo es el texto YA filtrado.
  const scan = scanPrivate(input.message);
  const note = input.attachments ? `\n[El cliente adjuntó ${input.attachments} archivo(s). Tú no puedes verlos; el equipo los revisará.]` : "";
  const userText = scan.text + note;
  const saveUser = (extra: Partial<Prisma.AuraMessageUncheckedCreateInput> = {}) =>
    db.auraMessage.create({ data: { conversationId: cid, role: "user", text: userText.slice(0, 1600), redacted: scan.kinds.length > 0, attachments: input.attachments, ...extra } });

  if (scan.block) {
    await saveUser({ errorKind: "privacy", text: "[mensaje bloqueado por contener datos privados]" });
    return sys("privacy", `Por tu seguridad no envié ese mensaje: incluye ${describeKinds(scan.kinds)}. No hace falta compartir esos datos en el chat. Edita el mensaje y vuelve a enviarlo.`, cid, { privacy: scan.kinds });
  }

  // 4) ¿Hay IA disponible?
  const provider = deps.provider !== undefined ? deps.provider : cfg.enabled && cfg.key && cfg.model ? geminiProvider(cfg.key, cfg.model, cfg.timeoutMs) : null;
  // Respaldo GRATUITO (otro modelo Flash del nivel gratuito, misma clave): solo si el principal está saturado.
  const backup = deps.fallbackProvider !== undefined ? deps.fallbackProvider : provider && cfg.key && cfg.fallbackModel ? geminiProvider(cfg.key, cfg.fallbackModel, cfg.timeoutMs) : null;
  if (!provider) {
    await saveUser({ errorKind: "unconfigured" });
    return sys("unconfigured", "La asistencia inteligente de AURA no está activa en este momento. Puedes registrar tu búsqueda con el asistente guiado o escribirnos por WhatsApp.", cid);
  }
  if (await isBlocked(COOLDOWN_KEY, 1)) {
    await saveUser({ errorKind: "quota" });
    return sys("quota", "La asistencia inteligente está temporalmente limitada por alta demanda. Tu mensaje sigue escrito: puedes intentarlo más tarde o usar el asistente guiado.", cid);
  }

  // 5) Historial (solo texto filtrado, sin datos de cliente) y llamada al modelo con herramientas.
  const past = await db.auraMessage.findMany({ where: { conversationId: cid, role: { in: ["user", "model"] }, errorKind: null }, orderBy: { createdAt: "desc" }, take: 12, select: { role: true, text: true } });
  const history: AuraTurn[] = [...past.reverse().map((m) => ({ role: m.role as AuraTurn["role"], text: m.text })), { role: "user", text: userText }];
  // Gemini exige que el historial empiece con el usuario.
  while (history.length && history[0].role !== "user") history.shift();

  const tools = createToolRunner(cfg, db);
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), cfg.timeoutMs);
  const dayKey = `aura:day:${pacificDay(deps.now)}`;
  try {
    const runOpts = {
      system: systemPrompt({ signedIn: !!viewer.customerId, catalogIsDemo: cfg.catalogIsDemo }),
      history, tools: TOOL_SPECS, execute: tools.execute, maxCalls: 3, signal: ctrl.signal,
      beforeCall: async () => (await consume(dayKey, cfg.dailyCalls, 26 * 60 * MIN)).allowed,
    };
    let r;
    // Si el principal estuvo saturado hace poco, se usa directamente el respaldo (no se gastan 20 s esperando).
    if (backup && (await isBlocked(PRIMARY_BUSY_KEY, 1))) {
      r = await backup.run(runOpts);
    } else {
      try {
        r = await provider.run(runOpts);
      } catch (e) {
        // Saturado o caído (5xx): se marca por 10 minutos. Ante cuota agotada o límite diario no se insiste.
        const busy = e instanceof AiError && e.kind === "unavailable";
        if (busy && backup) await registerHit(PRIMARY_BUSY_KEY, 10 * MIN);
        // El respaldo se intenta UNA vez en este mensaje, solo si queda tiempo (un 504 ya agotó la espera).
        if (!busy || !backup || ctrl.signal.aborted || (e as AiError).status === 504) throw e;
        console.warn("[aura] modelo principal saturado; usando el respaldo gratuito:", backup.id, (e as AiError).detail ?? "");
        r = await backup.run(runOpts);
      }
    }
    // Salida también revisada (defensa en profundidad) y acotada.
    const out = scanPrivate(r.text || "").text.slice(0, 2000) || "No tengo una respuesta clara para eso. ¿Me cuentas un poco más?";
    await saveUser({ tools: r.toolsUsed, tokensIn: r.tokensIn });
    await db.auraMessage.create({ data: { conversationId: cid, role: "model", text: out, tools: r.toolsUsed, tokensOut: r.tokensOut } });
    await db.auraConversation.update({
      where: { id: cid },
      data: { messageCount: { increment: 1 }, tokensIn: { increment: r.tokensIn }, tokensOut: { increment: r.tokensOut }, ...(tools.outputs.draft ? { draft: tools.outputs.draft as unknown as Prisma.InputJsonValue } : {}) },
    });
    return { conversationId: cid, source: "ia", text: out, state: "ok", products: tools.outputs.products, draft: tools.outputs.draft, handoff: tools.outputs.handoff, privacy: scan.kinds, fallback: false };
  } catch (e) {
    const err = e instanceof AiError ? e : new AiError("error", "Error inesperado");
    // Se registra la categoría, nunca el contenido ni la clave.
    console.error("[aura] fallo del proveedor:", err.kind, err.status ?? "", err.detail ?? "");
    await saveUser({ errorKind: err.kind });
    if (err.kind === "quota") {
      await registerHit(COOLDOWN_KEY, 15 * MIN);
      return sys("quota", "La asistencia inteligente está temporalmente limitada porque se alcanzó la cuota gratuita. Tu mensaje sigue escrito: inténtalo más tarde o usa el asistente guiado.", cid);
    }
    if (err.kind === "budget") return sys("quota", "AURA alcanzó su límite de uso de hoy. Puedes registrar tu búsqueda con el asistente guiado o escribirnos por WhatsApp.", cid);
    if (err.kind === "timeout") return sys("unavailable", "AURA está tardando más de lo normal. Tu mensaje sigue escrito: inténtalo de nuevo o usa el asistente guiado.", cid);
    return sys("unavailable", "AURA no está disponible en este momento. Tu mensaje sigue escrito: inténtalo de nuevo en un momento o usa el asistente guiado.", cid);
  } finally {
    clearTimeout(timer);
  }
}
