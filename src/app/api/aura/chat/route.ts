import { NextResponse } from "next/server";
import { chatInput, handleChat } from "@/lib/aura/chat";
import { getCurrentCustomer } from "@/lib/customer/auth";
import { getClientIp, isSameOrigin, readJson } from "@/lib/request";

export const runtime = "nodejs";
export const maxDuration = 30;

/**
 * POST /api/aura/chat — un mensaje del cliente a AURA.
 * Orden: origen → datos válidos → sesión (solo su id, nunca hacia el modelo) → límites, privacidad,
 * cuota y Gemini (en handleChat). La clave de Gemini vive solo en el servidor.
 */
export async function POST(req: Request) {
  if (!isSameOrigin(req)) return NextResponse.json({ error: "Origen no permitido" }, { status: 403 });
  const parsed = chatInput.safeParse(await readJson(req));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Mensaje no válido" }, { status: 400 });
  const customer = await getCurrentCustomer().catch(() => null);
  try {
    const reply = await handleChat(parsed.data, { ip: getClientIp(req), customerId: customer?.id ?? null });
    return NextResponse.json(reply, { status: reply.state === "limit" ? 429 : 200 });
  } catch (e) {
    console.error("[aura] chat:", e instanceof Error ? e.message : e);
    return NextResponse.json({ error: "AURA no está disponible en este momento. Usa el asistente guiado o escríbenos por WhatsApp." }, { status: 500 });
  }
}
