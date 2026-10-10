import { NextResponse } from "next/server";
import { WompiGateway } from "@/lib/payments/wompi";
import { applyPaymentEvent } from "@/lib/services/order-lifecycle";

export async function POST(req: Request) {
  let event;
  try {
    event = await new WompiGateway().verifyWebhook(req);
  } catch {
    return NextResponse.json({ error: "Webhook inválido" }, { status: 400 });
  }
  try {
    await applyPaymentEvent(event);
    return NextResponse.json({ ok: true });
  } catch {
    // Error interno: 500 para que Wompi reintente el evento.
    return NextResponse.json({ error: "No se pudo procesar el evento" }, { status: 500 });
  }
}
