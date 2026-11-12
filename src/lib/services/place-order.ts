import { createHash } from "node:crypto";
import type { Order, PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { CheckoutData } from "@/lib/schemas/checkout";
import type { ShippingQuote, ShippingZoneRule } from "@/lib/shipping";
import { mergeLines } from "@/lib/stock";
import { createOrder } from "./orders";

/**
 * Creación de pedido IDEMPOTENTE (BUG-03).
 *
 * El navegador envía una clave por intento de compra (`attemptKey`). Si la respuesta se pierde, el cliente
 * recarga o hace doble clic, el reintento llega con la MISMA clave y aquí se devuelve el pedido que ya existe:
 * no se crea otro pedido, no se reserva inventario dos veces, no se registra otro pago y no se envía otro correo.
 *
 * Tres defensas, de la más barata a la definitiva:
 * 1. Antes de crear: se busca un pedido con esa clave.
 * 2. Índice ÚNICO en la base (`Order.idempotencyKey`): si dos peticiones iguales llegan a la vez, la segunda
 *    falla dentro de su transacción (P2002) y su reserva de inventario se revierte sola.
 * 3. Huella del contenido: la misma clave con otro correo, otros productos u otro medio de pago se rechaza,
 *    así una clave no sirve para leer ni alterar el pedido de otra compra.
 */

export class OrderAttemptConflict extends Error {
  constructor() { super("ATTEMPT_KEY_CONFLICT"); }
}

/** Huella estable del intento: mismo comprador, mismos productos y mismo medio de pago. */
export function attemptHash(input: CheckoutData): string {
  const lines = mergeLines(input.items).map((l) => `${l.productId}:${l.size ?? ""}:${l.quantity}`).sort();
  return createHash("sha256").update(JSON.stringify([input.customer.email.toLowerCase(), input.paymentMethod, lines])).digest("hex");
}

const isUniqueViolation = (e: unknown) => typeof e === "object" && e !== null && (e as { code?: unknown }).code === "P2002";

export interface PlacedOrder {
  order: Order;
  /** true = se creó ahora; false = ya existía (reintento): no se repiten correo ni efectos secundarios. */
  created: boolean;
}

export interface PlaceOrderDeps {
  db?: PrismaClient;
  zones?: readonly ShippingZoneRule[];
  /** Cotización externa (Envia). Solo se llama si de verdad hay que crear el pedido. */
  quote?: () => Promise<ShippingQuote | undefined>;
}

export async function placeOrder(input: CheckoutData, deps: PlaceOrderDeps = {}): Promise<PlacedOrder> {
  const db = deps.db ?? prisma;
  const key = input.attemptKey;
  const hash = attemptHash(input);

  const existing = async () => {
    if (!key) return null;
    const found = await db.order.findUnique({ where: { idempotencyKey: key } });
    if (found && found.idempotencyHash !== hash) throw new OrderAttemptConflict();
    return found;
  };

  const before = await existing();
  if (before) return { order: before, created: false };

  const override = deps.quote ? await deps.quote() : undefined;
  try {
    const order = await createOrder(input, db, deps.zones ?? [], override, key ? { key, hash } : undefined);
    return { order, created: true };
  } catch (e) {
    // Carrera: otra petición con la misma clave ganó. Esta transacción ya se revirtió (sin reserva duplicada).
    if (key && isUniqueViolation(e)) {
      const winner = await existing();
      if (winner) return { order: winner, created: false };
    }
    throw e;
  }
}

/** Registra el pago pendiente una sola vez por pedido (un reintento no crea un segundo pago). */
export async function ensurePendingPayment(order: Pick<Order, "id" | "totalCOP">, data: { provider: "wompi" | "manual"; providerRef?: string }, db: PrismaClient = prisma) {
  const current = await db.payment.findFirst({ where: { orderId: order.id, provider: data.provider } });
  if (current) return current;
  return db.payment.create({ data: { orderId: order.id, provider: data.provider, providerRef: data.providerRef ?? null, status: "PENDING", amountCOP: order.totalCOP } });
}
