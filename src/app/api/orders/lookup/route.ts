import { NextResponse } from "next/server";
import { z } from "zod";
import { getOrderForTracking } from "@/lib/services/orders";
import { MIN, consume, tooMany } from "@/lib/rate-limit";
import { getClientIp, readJson } from "@/lib/request";
import { ORDER_CODE_RE, normalizeEmail, normalizeOrderCode } from "@/lib/order-tracking";

const schema = z.object({ publicCode: z.string().max(60), email: z.string().max(254) });

const NOT_FOUND = "No encontramos un pedido con esos datos. Revisa el número y el correo de la compra.";

/**
 * Rastreo público: exige número de pedido Y correo, limitado por IP.
 * Pedido inexistente y correo que no coincide responden EXACTAMENTE igual (no permite adivinar pedidos).
 * Solo se devuelven datos del pedido, nunca documento, teléfono ni dirección completa.
 */
export async function POST(req: Request) {
  const limit = await consume(`lookup:ip:${getClientIp(req)}`, 20, 10 * MIN);
  if (!limit.allowed) return tooMany(limit.retryAfterSec, "Hiciste muchas consultas seguidas. Espera unos minutos e inténtalo de nuevo.");

  const parsed = schema.safeParse(await readJson(req));
  if (!parsed.success) return NextResponse.json({ error: "Número de pedido o correo inválido.", code: "invalid" }, { status: 400 });
  const publicCode = normalizeOrderCode(parsed.data.publicCode);
  const email = normalizeEmail(parsed.data.email);
  if (!ORDER_CODE_RE.test(publicCode) || !z.email().safeParse(email).success) {
    return NextResponse.json({ error: "Revisa el formato del número de pedido y del correo.", code: "invalid" }, { status: 400 });
  }

  const order = await getOrderForTracking(publicCode, email);
  if (!order) return NextResponse.json({ error: NOT_FOUND, code: "not_found" }, { status: 404 });
  return NextResponse.json({
    order: {
      publicCode: order.publicCode,
      status: order.status.toLowerCase(),
      firstName: order.customerFullName.split(" ")[0] ?? "",
      paymentMethod: order.paymentMethod,
      subtotalCOP: order.subtotalCOP,
      shippingCOP: order.shippingCOP,
      totalCOP: order.totalCOP,
      trackingNumber: order.trackingNumber,
      carrier: order.carrier,
      city: order.city,
      department: order.department,
      shippingZone: order.shippingZone ?? null,
      shippingEta: order.shippingEta ?? null,
      createdAt: order.createdAt,
      expiresAt: order.expiresAt,
      items: order.items.map((i) => ({ name: i.name, size: i.size, quantity: i.quantity, unitPriceCOP: i.unitPriceCOP })),
    },
  });
}
