import { NextResponse } from "next/server";
import { checkoutSchema } from "@/lib/schemas/checkout";
import { OrderAttemptConflict, ensurePendingPayment, placeOrder } from "@/lib/services/place-order";
import { WompiGateway } from "@/lib/payments/wompi";
import { invalidateProducts } from "@/lib/cache";
import { prisma } from "@/lib/prisma";
import { MIN, consume, tooMany } from "@/lib/rate-limit";
import { getClientIp, readJson } from "@/lib/request";
import { notifyCustomer } from "@/lib/order-emails";
import { getShippingZones } from "@/lib/services/shipping-zones";
import { enviaUsesCheckoutRates } from "@/lib/envia";
import { quoteCart } from "@/lib/services/shipping-quote";

/**
 * GET /api/orders?intento=CLAVE — ¿existe ya un pedido para este intento de compra?
 * Lo usa el checkout cuando no recibió respuesta (red caída o tiempo agotado), antes de dejar reintentar.
 * La clave es un secreto aleatorio del navegador que hizo el intento; solo se devuelve el código y cómo seguir.
 */
export async function GET(req: Request) {
  const key = new URL(req.url).searchParams.get("intento") ?? "";
  if (!/^[A-Za-z0-9_-]{16,64}$/.test(key)) return NextResponse.json({ error: "Clave no válida" }, { status: 400 });
  const limit = await consume(`orders:attempt:ip:${getClientIp(req)}`, 60, 60 * MIN);
  if (!limit.allowed) return tooMany(limit.retryAfterSec, "Demasiadas consultas. Espera un momento.");
  const order = await prisma.order.findUnique({ where: { idempotencyKey: key }, select: { id: true, publicCode: true, status: true, totalCOP: true, customerEmail: true, paymentMethod: true } });
  if (!order) return NextResponse.json({ found: false }, { status: 404, headers: { "Cache-Control": "no-store" } });
  let redirectUrl: string | undefined;
  if (order.status === "PENDING_PAYMENT" && (order.paymentMethod === "CARD" || order.paymentMethod === "PSE")) {
    redirectUrl = (await new WompiGateway().createCheckout({ id: order.id, publicCode: order.publicCode, totalCOP: order.totalCOP, customerEmail: order.customerEmail, paymentMethod: order.paymentMethod === "CARD" ? "card" : "pse" })).redirectUrl;
  }
  return NextResponse.json({ found: true, publicCode: order.publicCode, redirectUrl }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(req: Request) {
  // Cada pedido reserva stock 24 h: se limita por IP para que nadie pueda "secuestrar" el inventario con bots.
  const limit = await consume(`orders:ip:${getClientIp(req)}`, 15, 60 * MIN);
  if (!limit.allowed) return tooMany(limit.retryAfterSec, "Hiciste demasiados pedidos seguidos. Espera un momento o escríbenos por Instagram.");

  try {
    const parsed = checkoutSchema.safeParse(await readJson(req));
    if (!parsed.success) {
      return NextResponse.json({ error: "Datos del pedido no válidos.", details: parsed.error.flatten() }, { status: 400 });
    }
    const data = parsed.data;
    // Idempotente: con la misma clave de intento se recupera el pedido ya creado (ver services/place-order).
    // Con tarifas reales de Envia se cotiza ANTES de la transacción y solo si hay que crear el pedido.
    const { order, created } = await placeOrder(data, {
      zones: await getShippingZones(),
      quote: enviaUsesCheckoutRates() ? () => quoteCart({ department: data.shipping.department, city: data.shipping.city, lines: data.items }) : undefined,
    });
    if (created) {
      invalidateProducts(); // el stock visible cambió
      notifyCustomer("created", { id: order.id }); // un reintento no repite el correo
    }
    const status = created ? 201 : 200;
    // Reintento sobre un pedido que ya no espera pago (pagado, vencido o cancelado): se muestra su página, no se cobra otra vez.
    if (!created && order.status !== "PENDING_PAYMENT") {
      return NextResponse.json({ orderId: order.id, publicCode: order.publicCode, next: "existing", replayed: true }, { status });
    }

    if (order.paymentMethod === "CARD" || order.paymentMethod === "PSE") {
      const gateway = new WompiGateway();
      // La referencia de pago es el código del pedido: un reintento obtiene el MISMO enlace de pago, no otro cobro.
      const checkout = await gateway.createCheckout({
        id: order.id,
        publicCode: order.publicCode,
        totalCOP: order.totalCOP,
        customerEmail: order.customerEmail,
        paymentMethod: order.paymentMethod === "CARD" ? "card" : "pse",
      });
      await ensurePendingPayment(order, { provider: "wompi", providerRef: checkout.providerRef });
      return NextResponse.json({ orderId: order.id, publicCode: order.publicCode, next: "gateway", redirectUrl: checkout.redirectUrl, replayed: !created }, { status });
    }

    await ensurePendingPayment(order, { provider: "manual" });
    return NextResponse.json({ orderId: order.id, publicCode: order.publicCode, next: "manual", replayed: !created }, { status });
  } catch (error) {
    if (error instanceof OrderAttemptConflict) return NextResponse.json({ error: "Tu carrito cambió desde el último intento. Recarga la página y confirma el pedido de nuevo." }, { status: 409 });
    const message = error instanceof Error ? error.message : "Error creando pedido";
    if (message.startsWith("OUT_OF_STOCK:")) return NextResponse.json({ error: `Sin stock suficiente: ${message.replace("OUT_OF_STOCK:", "")}` }, { status: 409 });
    if (message.startsWith("INVALID_SIZE:")) return NextResponse.json({ error: "La talla seleccionada ya no está disponible." }, { status: 409 });
    if (message.startsWith("PRODUCT_NOT_FOUND:")) return NextResponse.json({ error: "Uno de los productos ya no está disponible." }, { status: 409 });
    if (message === "CUSTOM_OFFER_OWNER") return NextResponse.json({ error: "Esta oferta personalizada es para otra persona. Usa el mismo correo de tu solicitud." }, { status: 403 });
    if (message === "CUSTOM_OFFER_UNAVAILABLE") return NextResponse.json({ error: "Tu oferta personalizada venció o ya no está disponible. Escríbenos y la actualizamos." }, { status: 409 });
    if (message === "CUSTOM_OFFER_QUANTITY") return NextResponse.json({ error: "La oferta personalizada es por 1 unidad." }, { status: 400 });
    if (message === "CUSTOM_OFFER_IN_USE") return NextResponse.json({ error: "Ya hay un pedido en curso con esta oferta. Revísalo en Mi cuenta." }, { status: 409 });
    console.error("[orders] error al crear pedido:", message);
    return NextResponse.json({ error: "No pudimos crear el pedido. Inténtalo de nuevo." }, { status: 500 });
  }
}
