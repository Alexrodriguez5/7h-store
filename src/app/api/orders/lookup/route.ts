import { NextResponse } from "next/server";
import { z } from "zod";
import { getOrderForTracking } from "@/lib/services/orders";
import { MIN, consume, tooMany } from "@/lib/rate-limit";
import { getClientIp, readJson } from "@/lib/request";

const schema = z.object({ publicCode: z.string().trim().min(5).max(40), email: z.string().trim().email().max(200) });

/** Rastreo público: exige número de pedido Y correo. Limitado por IP para impedir adivinar códigos. */
export async function POST(req: Request) {
  const limit = await consume(`lookup:ip:${getClientIp(req)}`, 20, 10 * MIN);
  if (!limit.allowed) return tooMany(limit.retryAfterSec, "Demasiadas consultas. Espera unos minutos e inténtalo de nuevo.");

  const parsed = schema.safeParse(await readJson(req));
  if (!parsed.success) return NextResponse.json({ error: "Número de pedido o correo inválido." }, { status: 400 });
  const order = await getOrderForTracking(parsed.data.publicCode.toUpperCase(), parsed.data.email);
  if (!order) return NextResponse.json({ error: "No encontramos un pedido con esos datos. Revisa el número y el correo." }, { status: 404 });
  return NextResponse.json({
    order: {
      publicCode: order.publicCode,
      status: order.status.toLowerCase(),
      customerFullName: order.customerFullName,
      subtotalCOP: order.subtotalCOP,
      shippingCOP: order.shippingCOP,
      totalCOP: order.totalCOP,
      trackingNumber: order.trackingNumber,
      carrier: order.carrier,
      createdAt: order.createdAt,
      items: order.items.map((i) => ({ name: i.name, size: i.size, quantity: i.quantity, unitPriceCOP: i.unitPriceCOP })),
    },
  });
}
