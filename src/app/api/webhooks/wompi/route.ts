import { NextResponse } from "next/server";
import { WompiGateway } from "@/lib/payments/wompi";
import { applyPaymentEvent } from "@/lib/services/order-lifecycle";

/**
 * Webhook de Wompi ("URL de Eventos"). Se responde:
 * - 400 si la firma no es válida (Wompi no reintenta: el evento no es auténtico).
 * - 200 si se procesó (también para eventos repetidos: es idempotente).
 * - 500 si hubo un error interno, para que Wompi reintente.
 * Los logs nunca incluyen secretos ni datos de la tarjeta.
 */
export async function POST(req: Request) {
  let event;
  try {
    event = await new WompiGateway().verifyWebhook(req);
  } catch (e) {
    console.warn("[wompi-webhook] rechazado:", e instanceof Error ? e.message : "cuerpo no válido");
    return NextResponse.json({ error: "Webhook inválido" }, { status: 400 });
  }
  try {
    const result = await applyPaymentEvent(event);
    console.info(`[wompi-webhook] ${event.publicCode} ${event.status} → ${result}`);
    if (result === "amount_mismatch") console.warn(`[wompi-webhook] ${event.publicCode}: el monto o la moneda no coinciden con el pedido; NO se marcó como pagado.`);
    return NextResponse.json({ ok: true, result });
  } catch (e) {
    console.error("[wompi-webhook] fallo al procesar:", e instanceof Error ? e.message : e);
    return NextResponse.json({ error: "No se pudo procesar el evento" }, { status: 500 });
  }
}
