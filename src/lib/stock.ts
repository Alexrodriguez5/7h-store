import type { Prisma } from "@prisma/client";

export type Tx = Prisma.TransactionClient;

export interface StockLine {
  productId: string;
  variantId?: string | null;
  quantity: number;
  name: string;
}

/** Une líneas repetidas (mismo producto y talla) para validar la suma real. */
export function mergeLines<T extends { productId: string; size?: string; quantity: number }>(lines: T[]): T[] {
  const map = new Map<string, T>();
  for (const l of lines) {
    const key = `${l.productId}::${l.size ?? ""}`;
    const prev = map.get(key);
    map.set(key, prev ? { ...prev, quantity: prev.quantity + l.quantity } : { ...l });
  }
  return [...map.values()];
}

/**
 * Reserva stock de forma atómica: el UPDATE solo se aplica si `stock >= quantity`.
 * Dos compradores simultáneos no pueden dejar el stock en negativo ni sobrevender.
 */
export async function reserveStock(tx: Tx, line: StockLine): Promise<void> {
  if (!Number.isInteger(line.quantity) || line.quantity <= 0) throw new Error(`OUT_OF_STOCK:${line.name}`);
  const result = line.variantId
    ? await tx.productVariant.updateMany({
        where: { id: line.variantId, stock: { gte: line.quantity } },
        data: { stock: { decrement: line.quantity } },
      })
    : await tx.product.updateMany({
        where: { id: line.productId, stock: { gte: line.quantity } },
        data: { stock: { decrement: line.quantity } },
      });
  if (result.count !== 1) throw new Error(`OUT_OF_STOCK:${line.name}`);
}

/** Devuelve al inventario las unidades reservadas por un pedido. */
export async function releaseOrderStock(tx: Tx, orderId: string): Promise<void> {
  const items = await tx.orderItem.findMany({ where: { orderId } });
  for (const item of items) {
    if (item.variantId) {
      await tx.productVariant.update({ where: { id: item.variantId }, data: { stock: { increment: item.quantity } } });
    } else {
      await tx.product.update({ where: { id: item.productId }, data: { stock: { increment: item.quantity } } });
    }
  }
}

/**
 * Cambia el estado solo si el pedido sigue en alguno de los estados `from`.
 * Es el "candado" que evita dobles transiciones (y por tanto doble liberación de stock).
 */
export async function claimTransition(
  tx: Tx,
  orderId: string,
  from: Prisma.OrderWhereInput["status"],
  data: Prisma.OrderUpdateManyMutationInput,
  extraWhere: Prisma.OrderWhereInput = {}
): Promise<boolean> {
  const r = await tx.order.updateMany({ where: { id: orderId, status: from, ...extraWhere }, data });
  return r.count === 1;
}
