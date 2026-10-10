import type { Prisma, PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { slugify, type ProductInput } from "@/lib/schemas/admin";
import { sortSizes } from "@/lib/sizes";

export class ProductError extends Error {
  constructor(public status: 400 | 404 | 409, message: string) { super(message); }
}

const sumStock = (variants: { stock: number }[], fallback: number) => (variants.length ? variants.reduce((n, v) => n + v.stock, 0) : fallback);

async function categoryId(tx: Prisma.TransactionClient, slug: string) {
  const c = await tx.category.findUnique({ where: { slug } });
  if (!c) throw new ProductError(400, "Categoría no válida.");
  return c.id;
}

async function assertUnique(tx: Prisma.TransactionClient, input: ProductInput, slug: string, excludeId?: string) {
  const notSelf = excludeId ? { id: { not: excludeId } } : {};
  if (await tx.product.findFirst({ where: { slug, ...notSelf } })) throw new ProductError(409, "Ya existe un producto con ese slug.");
  const dup = await tx.product.findFirst({
    where: { name: { equals: input.name, mode: "insensitive" }, brand: { equals: input.brand, mode: "insensitive" }, ...notSelf },
  });
  if (dup) throw new ProductError(409, "Ya existe un producto con el mismo nombre y marca.");
}

export async function createProduct(input: ProductInput, db: PrismaClient = prisma) {
  return db.$transaction(async (tx) => {
    const slug = input.slug || slugify(input.name);
    if (!slug) throw new ProductError(400, "No se pudo generar el slug.");
    await assertUnique(tx, input, slug);
    const variants = sortSizes(input.variants.map((v) => v.size)).map((size) => input.variants.find((v) => v.size === size)!);
    return tx.product.create({
      data: {
        slug,
        name: input.name,
        brand: input.brand,
        description: input.description,
        priceCOP: input.priceCOP,
        compareAtPriceCOP: input.compareAtPriceCOP ?? null,
        categoryId: await categoryId(tx, input.category),
        gender: input.gender,
        isAccessory: input.isAccessory,
        images: input.images,
        sizes: variants.map((v) => v.size),
        stock: sumStock(variants, input.stock),
        tags: input.tags,
        featured: input.featured,
        active: input.active,
        variants: { create: variants.map((v) => ({ size: v.size, stock: v.stock })) },
      },
    });
  });
}

export async function updateProduct(id: string, input: ProductInput, db: PrismaClient = prisma) {
  return db.$transaction(async (tx) => {
    const current = await tx.product.findUnique({ where: { id }, include: { variants: { include: { _count: { select: { orderItems: true } } } } } });
    if (!current) throw new ProductError(404, "Producto no encontrado.");
    const slug = input.slug || current.slug;
    await assertUnique(tx, input, slug, id);

    const incoming = new Map(input.variants.map((v) => [v.size, v]));
    const removed = current.variants.filter((v) => !incoming.has(v.size));
    if (input.variants.length === 0 && removed.some((v) => v._count.orderItems > 0)) {
      throw new ProductError(409, "No puedes quitar todas las tallas: algunas tienen pedidos. Déjalas en stock 0 o desactiva el producto.");
    }
    for (const v of removed) {
      if (v._count.orderItems === 0) await tx.productVariant.delete({ where: { id: v.id } });
      else await tx.productVariant.update({ where: { id: v.id }, data: { stock: 0 } }); // conserva el historial
    }
    const keptRemoved = removed.filter((v) => v._count.orderItems > 0);
    for (const v of input.variants) {
      await tx.productVariant.upsert({
        where: { productId_size: { productId: id, size: v.size } },
        update: { stock: v.stock },
        create: { productId: id, size: v.size, stock: v.stock },
      });
    }
    const allSizes = sortSizes([...input.variants.map((v) => v.size), ...keptRemoved.map((v) => v.size)]);
    return tx.product.update({
      where: { id },
      data: {
        slug,
        name: input.name,
        brand: input.brand,
        description: input.description,
        priceCOP: input.priceCOP,
        compareAtPriceCOP: input.compareAtPriceCOP ?? null,
        categoryId: await categoryId(tx, input.category),
        gender: input.gender,
        isAccessory: input.isAccessory,
        images: input.images,
        sizes: allSizes,
        stock: allSizes.length ? input.variants.reduce((n, v) => n + v.stock, 0) : input.stock,
        tags: input.tags,
        featured: input.featured,
        active: input.active,
      },
    });
  });
}

export async function setProductActive(id: string, active: boolean, db: PrismaClient = prisma) {
  const r = await db.product.updateMany({ where: { id }, data: { active } });
  if (r.count !== 1) throw new ProductError(404, "Producto no encontrado.");
}

/** Elimina físicamente SOLO si no tiene pedidos; de lo contrario obliga a desactivar. */
export async function deleteProduct(id: string, db: PrismaClient = prisma) {
  return db.$transaction(async (tx) => {
    if (!(await tx.product.findUnique({ where: { id }, select: { id: true } }))) throw new ProductError(404, "Producto no encontrado.");
    const orders = await tx.orderItem.count({ where: { productId: id } });
    if (orders > 0) throw new ProductError(409, `Este producto tiene ${orders} línea(s) de pedidos. Para no romper el historial, desactívalo en lugar de eliminarlo.`);
    await tx.product.delete({ where: { id } });
  });
}

export async function setStock(id: string, input: { stock: number } | { variants: { id: string; stock: number }[] }, db: PrismaClient = prisma) {
  return db.$transaction(async (tx) => {
    const product = await tx.product.findUnique({ where: { id }, include: { variants: true } });
    if (!product) throw new ProductError(404, "Producto no encontrado.");
    if ("variants" in input) {
      if (product.variants.length === 0) throw new ProductError(400, "Este producto no maneja tallas.");
      const ids = new Set(product.variants.map((v) => v.id));
      for (const v of input.variants) {
        if (!ids.has(v.id)) throw new ProductError(400, "Talla no pertenece al producto.");
        await tx.productVariant.update({ where: { id: v.id }, data: { stock: v.stock } });
      }
      const agg = await tx.productVariant.aggregate({ where: { productId: id }, _sum: { stock: true } });
      return tx.product.update({ where: { id }, data: { stock: agg._sum.stock ?? 0 } });
    }
    if (product.variants.length > 0) throw new ProductError(400, "Este producto maneja stock por talla.");
    return tx.product.update({ where: { id }, data: { stock: input.stock } });
  });
}
