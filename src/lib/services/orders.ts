import { prisma } from "@/lib/prisma";
import { quoteShipping, totalWeight, type ShippingQuote, type ShippingZoneRule } from "@/lib/shipping";
import type { CheckoutInput } from "@/lib/schemas/checkout";
import { mergeLines, reserveStock, type StockLine } from "@/lib/stock";
import { randomBytes } from "node:crypto";
import type { PrismaClient } from "@prisma/client";

const paymentMethodMap = {
  card: "CARD",
  pse: "PSE",
  bank_transfer: "BANK_TRANSFER",
  cash_deposit: "CASH_DEPOSIT",
} as const;

/** `zones`: tarifas por zona vigentes. Sin zonas se cobra la tarifa histórica (comportamiento anterior). */
export async function createOrder(input: CheckoutInput, db: PrismaClient = prisma, zones: readonly ShippingZoneRule[] = [], shippingOverride?: ShippingQuote) {
  return db.$transaction(async (tx) => {
    const lines = mergeLines(input.items);
    const ids = [...new Set(lines.map((item) => item.productId))];
    const products = await tx.product.findMany({ where: { id: { in: ids } }, include: { variants: true } });
    const byId = new Map(products.map((product) => [product.id, product]));
    let subtotal = 0;

    const resolved = lines.map((line) => {
      const product = byId.get(line.productId);
      // Un producto desactivado no se puede comprar aunque siga en un carrito antiguo.
      if (!product || !product.active) throw new Error(`PRODUCT_NOT_FOUND:${line.productId}`);

      let variantId: string | null = null;
      let size: string | undefined;
      if (product.variants.length > 0) {
        const variant = line.size ? product.variants.find((v) => v.size === line.size) : undefined;
        if (!variant) throw new Error(`INVALID_SIZE:${product.name}`);
        variantId = variant.id;
        size = variant.size;
      } else if (product.sizes.length > 0) {
        // Producto aún sin migrar a variantes: se conserva el comportamiento anterior.
        if (!line.size || !product.sizes.includes(line.size)) throw new Error(`INVALID_SIZE:${product.name}`);
        size = line.size;
      }
      subtotal += product.priceCOP * line.quantity;
      const stockLine: StockLine = { productId: product.id, variantId, quantity: line.quantity, name: product.name };
      return { product, size, stockLine };
    });

    // El servidor cotiza con los pesos REALES de la base de datos (no confía en el navegador).
    const weightGrams = totalWeight(resolved.map(({ product, stockLine }) => ({ weightGrams: (product as { weightGrams?: number | null }).weightGrams, quantity: stockLine.quantity })));
    // `shippingOverride`: cotización ya hecha en el servidor con la tarifa real de la transportadora (Envia).
    const quote = shippingOverride ?? quoteShipping({ subtotalCOP: subtotal, weightGrams, department: input.shipping.department, zones });
    const shipping = quote.costCOP;
    const total = subtotal + shipping;
    const publicCode = `7H-${new Date().getFullYear()}-${randomBytes(4).toString("hex").toUpperCase()}`;

    // Reserva atómica ANTES de crear el pedido: si falta stock se revierte todo.
    for (const { stockLine } of resolved) await reserveStock(tx, stockLine);

    return tx.order.create({
      data: {
        publicCode,
        status: "PENDING_PAYMENT",
        paymentMethod: paymentMethodMap[input.paymentMethod],
        customerFullName: input.customer.fullName,
        customerEmail: input.customer.email.toLowerCase(),
        customerPhone: input.customer.phone,
        documentType: input.customer.documentType,
        documentNumber: input.customer.documentNumber,
        department: input.shipping.department,
        city: input.shipping.city,
        address: input.shipping.address,
        notes: [input.shipping.neighborhood, input.shipping.notes].filter(Boolean).join(" · ") || null,
        subtotalCOP: subtotal,
        shippingCOP: shipping,
        shippingZone: quote.zone,
        shippingEta: quote.eta,
        totalCOP: total,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        items: {
          create: resolved.map(({ product, size, stockLine }) => ({
            productId: product.id,
            variantId: stockLine.variantId ?? null,
            name: product.name,
            size,
            unitPriceCOP: product.priceCOP,
            quantity: stockLine.quantity,
          })),
        },
      },
    });
  }, { maxWait: 10_000, timeout: 15_000 }); // margen para bases de datos lejanas (Supabase en otra región)
}

export async function getOrderForTracking(publicCode: string, email: string) {
  return prisma.order.findFirst({
    where: { publicCode, customerEmail: email.toLowerCase() },
    include: { items: true, payments: { orderBy: { createdAt: "desc" } } },
  });
}
