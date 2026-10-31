import { NextResponse } from "next/server";
import { checkoutSchema } from "@/lib/schemas/checkout";
import { createOrder } from "@/lib/services/orders";
import { WompiGateway } from "@/lib/payments/wompi";
import { prisma } from "@/lib/prisma";
import { invalidateProducts } from "@/lib/cache";
import { MIN, consume, tooMany } from "@/lib/rate-limit";
import { getClientIp, readJson } from "@/lib/request";
import { notifyCustomer } from "@/lib/order-emails";
import { getShippingZones } from "@/lib/services/shipping-zones";

export async function POST(req: Request) {
  // Cada pedido reserva stock 24 h: se limita por IP para que nadie pueda "secuestrar" el inventario con bots.
  const limit = await consume(`orders:ip:${getClientIp(req)}`, 15, 60 * MIN);
  if (!limit.allowed) return tooMany(limit.retryAfterSec, "Hiciste demasiados pedidos seguidos. Espera un momento o escríbenos por Instagram.");

  try {
    const parsed = checkoutSchema.safeParse(await readJson(req));
    if (!parsed.success) {
      return NextResponse.json({ error: "Datos del pedido no válidos.", details: parsed.error.flatten() }, { status: 400 });
    }
    const order = await createOrder(parsed.data, undefined, await getShippingZones());
    invalidateProducts(); // el stock visible cambió
    notifyCustomer("created", { id: order.id });

    if (parsed.data.paymentMethod === "card" || parsed.data.paymentMethod === "pse") {
      const gateway = new WompiGateway();
      const checkout = await gateway.createCheckout({
        id: order.id,
        publicCode: order.publicCode,
        totalCOP: order.totalCOP,
        customerEmail: order.customerEmail,
        paymentMethod: parsed.data.paymentMethod,
      });
      await prisma.payment.create({
        data: { orderId: order.id, provider: "wompi", providerRef: checkout.providerRef, status: "PENDING", amountCOP: order.totalCOP },
      });
      return NextResponse.json(
        { orderId: order.id, publicCode: order.publicCode, next: "gateway", redirectUrl: checkout.redirectUrl },
        { status: 201 },
      );
    }

    await prisma.payment.create({ data: { orderId: order.id, provider: "manual", status: "PENDING", amountCOP: order.totalCOP } });
    return NextResponse.json({ orderId: order.id, publicCode: order.publicCode, next: "manual" }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error creando pedido";
    if (message.startsWith("OUT_OF_STOCK:")) return NextResponse.json({ error: `Sin stock suficiente: ${message.replace("OUT_OF_STOCK:", "")}` }, { status: 409 });
    if (message.startsWith("INVALID_SIZE:")) return NextResponse.json({ error: "La talla seleccionada ya no está disponible." }, { status: 409 });
    if (message.startsWith("PRODUCT_NOT_FOUND:")) return NextResponse.json({ error: "Uno de los productos ya no está disponible." }, { status: 409 });
    console.error("[orders] error al crear pedido:", message);
    return NextResponse.json({ error: "No pudimos crear el pedido. Inténtalo de nuevo." }, { status: 500 });
  }
}
