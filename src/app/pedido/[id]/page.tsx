import { PageBody, PageHero } from "@/components/aura/PageHero";
import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { formatCOP } from "@/lib/format";
import { Button } from "@/components/ui/Button";
import { WompiGateway } from "@/lib/payments/wompi";
import { ProofUploader } from "@/components/orders/ProofUploader";
import { ORDER_STATUS_LABEL } from "@/lib/order-status";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { getClientIpFromHeaders } from "@/lib/request";
import { MIN, isBlocked, registerHit } from "@/lib/rate-limit";

export const metadata: Metadata = { title: "Tu pedido", robots: { index: false, follow: false } };

/** Búsquedas fallidas permitidas por IP en 15 minutos. */
const ORDER_MISS_LIMIT = 20;

const STATUS_MESSAGE: Record<string, string> = {
  PENDING_PAYMENT: "Estamos esperando la confirmación de tu pago.",
  PAID: "¡Pago confirmado! Pronto empezaremos a preparar tu pedido.",
  PROCESSING: "Estamos preparando tu pedido.",
  SHIPPED: "Tu pedido va en camino.",
  DELIVERED: "Tu pedido fue entregado. ¡Gracias por comprar en 7H STORE!",
  CANCELLED: "Este pedido fue cancelado.",
  EXPIRED: "El plazo de pago venció y las unidades se liberaron. Puedes hacer un pedido nuevo.",
};

export default async function OrderPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ id?: string }>;
}) {
  const [{ id }, sp, h] = await Promise.all([params, searchParams, headers()]);
  // Límite por IP a las búsquedas FALLIDAS: impide probar códigos al azar sin afectar a quien
  // recarga su propio pedido. Un código con formato inválido no consulta la base de datos.
  const missKey = `pedido-miss:ip:${getClientIpFromHeaders(h)}`;
  if (await isBlocked(missKey, ORDER_MISS_LIMIT))
    return (
      <main id="contenido" className="mx-auto max-w-xl px-5 py-24 text-center">
        <h1 className="font-display text-4xl">Demasiados intentos.</h1>
        <p className="mt-4 text-ink/70">Espera unos minutos e inténtalo de nuevo, o entra a tu cuenta para ver tus pedidos.</p>
        <Button href="/cuenta/pedidos" className="mt-6">Ver mis pedidos</Button>
      </main>
    );
  const order = /^[A-Za-z0-9-]{6,40}$/.test(id)
    ? await prisma.order.findFirst({ where: { OR: [{ publicCode: id }, { id }] }, include: { items: true } })
    : null;
  if (!order) {
    await registerHit(missKey, 15 * MIN);
    notFound();
  }

  const manual = order.paymentMethod === "BANK_TRANSFER" || order.paymentMethod === "CASH_DEPOSIT";
  // Solo se puede pagar un pedido pendiente y vigente: evita cobros dobles sobre pedidos pagados, vencidos o cancelados.
  const payable = order.status === "PENDING_PAYMENT" && order.expiresAt > new Date();
  // Wompi devuelve al cliente con ?id=<transacción>. El pago lo confirma SOLO el webhook firmado.
  const returnedFromGateway = !manual && !!sp.id && order.status === "PENDING_PAYMENT";
  const gatewayUrl =
    !manual && payable
      ? (
          await new WompiGateway().createCheckout({
            id: order.id,
            publicCode: order.publicCode,
            totalCOP: order.totalCOP,
            customerEmail: order.customerEmail,
            paymentMethod: order.paymentMethod === "PSE" ? "pse" : "card",
          })
        ).redirectUrl
      : null;
  const bank = {
    name: process.env.BANK_NAME,
    account: process.env.BANK_ACCOUNT,
    type: process.env.BANK_ACCOUNT_TYPE,
    holder: process.env.BANK_HOLDER,
    document: process.env.BANK_DOCUMENT,
  };
  const deadline = new Intl.DateTimeFormat("es-CO", { dateStyle: "medium", timeStyle: "short", timeZone: "America/Bogota" }).format(order.expiresAt);

  return (
    <main id="contenido">
      <PageHero quiet eyebrow="Pedido" title={<span className="break-all">{order.publicCode}</span>}>
        <div className="flex flex-wrap items-center gap-3">
          <span className="glass-dark rounded-full px-3 py-1 text-xs font-semibold text-gold-light">{ORDER_STATUS_LABEL[order.status]}</span>
          <p className="text-sm text-ivory/75">{STATUS_MESSAGE[order.status]}</p>
        </div>
        <p className="mt-3 text-xs text-ivory/55">Guarda este número: lo necesitas, junto con tu correo, para rastrear el pedido.</p>
      </PageHero>
      <PageBody className="max-w-3xl">
      <div className="surface rounded-[28px] p-6 sm:p-8">

      {returnedFromGateway && (
        <div role="status" className="mt-8 rounded-2xl border border-gold/40 bg-gold/5 p-5 text-sm leading-6">
          Recibimos tu regreso desde la pasarela. Wompi nos confirma el resultado en unos segundos.{" "}
          <Link href={`/pedido/${order.publicCode}`} className="font-semibold underline">Actualizar estado</Link>
        </div>
      )}

      {manual && payable && (
        <section className="mt-10 rounded-2xl border border-gold/40 bg-gold/5 p-6">
          <h2 className="font-display text-3xl">Completa tu pago</h2>
          <p className="mt-2 text-sm leading-6">Transfiere o consigna el valor exacto y sube el comprobante. Confirmamos el pago al verificarlo en la cuenta.</p>
          {bank.account ? (
            <dl className="mt-5 space-y-2 text-sm">
              {bank.name && <div className="flex justify-between gap-4"><dt>Banco</dt><dd>{bank.name}</dd></div>}
              {bank.type && <div className="flex justify-between gap-4"><dt>Tipo de cuenta</dt><dd>{bank.type}</dd></div>}
              <div className="flex justify-between gap-4"><dt>Cuenta</dt><dd className="font-semibold">{bank.account}</dd></div>
              {bank.holder && <div className="flex justify-between gap-4"><dt>Titular</dt><dd>{bank.holder}</dd></div>}
              {bank.document && <div className="flex justify-between gap-4"><dt>NIT / documento</dt><dd>{bank.document}</dd></div>}
              <div className="flex justify-between gap-4 border-t border-gold/30 pt-2 font-semibold"><dt>Total a pagar</dt><dd>{formatCOP(order.totalCOP)}</dd></div>
            </dl>
          ) : (
            <p className="mt-5 text-sm">Escríbenos para recibir los datos de la cuenta. Total a pagar: <strong>{formatCOP(order.totalCOP)}</strong>.</p>
          )}
          <p className="mt-4 text-xs text-ink-soft">Referencia: <strong>{order.publicCode}</strong> · Paga antes de: <strong>{deadline}</strong>.</p>
          <ProofUploader orderId={order.publicCode} />
        </section>
      )}

      {gatewayUrl && (
        <section className="mt-10 rounded-2xl border border-ink/10 bg-white/40 p-6 shadow-soft">
          <h2 className="font-display text-3xl">Pago en línea</h2>
          <p className="mt-2 text-sm leading-6">
            Paga de forma segura con {order.paymentMethod === "PSE" ? "PSE" : "tarjeta"} a través de Wompi. Tienes hasta el <strong>{deadline}</strong>.
          </p>
          <a href={gatewayUrl} className="mt-5 inline-block rounded-full bg-ink px-6 py-3 text-sm font-semibold text-ivory transition-colors hover:bg-gold hover:text-ink">
            {returnedFromGateway ? "Intentar el pago de nuevo" : "Continuar al pago"}
          </a>
        </section>
      )}

      <section className="mt-10 rounded-2xl border border-ink/10 bg-white/40 p-6 shadow-soft">
        <h2 className="font-display text-3xl">Resumen</h2>
        <div className="mt-5 space-y-3">
          {order.items.map((i) => (
            <div key={i.id} className="flex justify-between gap-4 text-sm">
              <span>{i.name} × {i.quantity}{i.size ? ` · Talla ${i.size}` : ""}</span>
              <span>{formatCOP(i.unitPriceCOP * i.quantity)}</span>
            </div>
          ))}
        </div>
        <div className="mt-5 space-y-2 border-t border-ink/10 pt-4 text-sm">
          <div className="flex justify-between"><span>Subtotal</span><span>{formatCOP(order.subtotalCOP)}</span></div>
          <div className="flex justify-between"><span>Envío{order.shippingZone ? ` · ${order.shippingZone}` : ""}</span><span>{order.shippingCOP === 0 ? "Gratis" : formatCOP(order.shippingCOP)}</span></div>
          {order.shippingEta && <p className="text-xs text-ink-soft">Entrega estimada: {order.shippingEta} después de confirmar el pago.</p>}
          <div className="flex justify-between font-semibold"><span>Total</span><span>{formatCOP(order.totalCOP)}</span></div>
        </div>
      </section>
      <div className="mt-8 flex flex-wrap gap-3">
        <Button href={`/pedidos?codigo=${order.publicCode}`}>Rastrear pedido</Button>
        <Button href="/catalogo" variant="secondary">Seguir comprando</Button>
      </div>
      </div>
      </PageBody>
    </main>
  );
}
