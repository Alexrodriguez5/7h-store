import type { Prisma, PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { slugify, type ProductInput, type StockInput } from "@/lib/schemas/admin";
import { sortSizes } from "@/lib/sizes";

export class ProductError extends Error {
  constructor(public status: 400 | 404 | 409, message: string) { super(message); }
}

/** Tiempo de espera de las transacciones: con una base de datos lejana (Supabase en otra región) 5 s no siempre alcanzan. */
const TX = { maxWait: 10_000, timeout: 15_000 };

const sumStock = (variants: { stock: number }[], fallback: number) => (variants.length ? variants.reduce((n, v) => n + v.stock, 0) : fallback);

const conflict = (what: string) =>
  new ProductError(409, `El stock de ${what} cambió mientras editabas (probablemente por una compra). Recarga la página y vuelve a ajustarlo.`);

/** Devuelve el id de la categoría. Un producto ACTIVO solo puede quedar en una categoría activa. */
async function resolveCategory(db: PrismaClient | Prisma.TransactionClient, slug: string, productActive: boolean) {
  const c = await db.category.findUnique({ where: { slug }, select: { id: true, label: true, active: true } });
  if (!c) throw new ProductError(400, "Categoría no válida.");
  if (productActive && !c.active) throw new ProductError(400, `La categoría «${c.label}» está desactivada. Actívala o guarda el producto como inactivo.`);
  return c.id;
}

/** Una sola consulta para slug y nombre+marca duplicados. */
async function assertUnique(db: PrismaClient | Prisma.TransactionClient, input: ProductInput, slug: string, excludeId?: string) {
  const rows = await db.product.findMany({
    where: {
      ...(excludeId ? { id: { not: excludeId } } : {}),
      OR: [{ slug }, { name: { equals: input.name, mode: "insensitive" }, brand: { equals: input.brand, mode: "insensitive" } }],
    },
    select: { slug: true },
    take: 2,
  });
  if (rows.some((r) => r.slug === slug)) throw new ProductError(409, "Ya existe un producto con ese slug.");
  if (rows.length > 0) throw new ProductError(409, "Ya existe un producto con el mismo nombre y marca.");
}

const baseData = (input: ProductInput) => ({
  name: input.name,
  brand: input.brand,
  description: input.description,
  priceCOP: input.priceCOP,
  compareAtPriceCOP: input.compareAtPriceCOP ?? null,
  gender: input.gender,
  isAccessory: input.isAccessory,
  images: input.images,
  tags: input.tags,
  featured: input.featured,
  active: input.active,
});

/**
 * Crea producto + tallas. Las validaciones de lectura se hacen en paralelo y la escritura es
 * una única creación anidada (atómica). Un slug duplicado por carrera lo rechaza el índice único (P2002 → 409).
 */
export async function createProduct(input: ProductInput, db: PrismaClient = prisma) {
  const slug = input.slug || slugify(input.name);
  if (!slug) throw new ProductError(400, "No se pudo generar el slug.");
  const [categoryId] = await Promise.all([resolveCategory(db, input.category, input.active), assertUnique(db, input, slug)]);
  const variants = sortSizes(input.variants.map((v) => v.size)).map((size) => input.variants.find((v) => v.size === size)!);
  return db.product.create({
    data: {
      ...baseData(input),
      slug,
      categoryId,
      sizes: variants.map((v) => v.size),
      stock: sumStock(variants, input.stock),
      variants: { create: variants.map((v) => ({ size: v.size, stock: v.stock })) },
    },
  });
}

/**
 * Edita un producto escribiendo SOLO lo que cambió.
 * Stock: si el formulario envía `expectedStock` (lo que el admin vio) y el valor no cambió, no se toca:
 * así guardar la descripción no "deshace" unidades reservadas por compras hechas mientras tanto.
 * Si el admin sí lo cambió pero la base ya no coincide con lo que vio → 409 (sin sobrescribir).
 */
export async function updateProduct(id: string, input: ProductInput, db: PrismaClient = prisma) {
  const [current, categoryId] = await Promise.all([
    db.product.findUnique({
      where: { id },
      select: { id: true, slug: true, stock: true, images: true, variants: { select: { id: true, size: true, stock: true, _count: { select: { orderItems: true } } } } },
    }),
    resolveCategory(db, input.category, input.active),
  ]);
  if (!current) throw new ProductError(404, "Producto no encontrado.");
  const slug = input.slug || current.slug;
  await assertUnique(db, input, slug, id);

  const incoming = new Map(input.variants.map((v) => [v.size, v]));
  const bySize = new Map(current.variants.map((v) => [v.size, v]));
  const removed = current.variants.filter((v) => !incoming.has(v.size));
  if (input.variants.length === 0 && removed.some((v) => v._count.orderItems > 0)) {
    throw new ProductError(409, "No puedes quitar todas las tallas: algunas tienen pedidos. Déjalas en stock 0 o desactiva el producto.");
  }
  const toDelete = removed.filter((v) => v._count.orderItems === 0).map((v) => v.id);
  const toZero = removed.filter((v) => v._count.orderItems > 0 && v.stock !== 0).map((v) => v.id); // se conserva el historial
  const keptRemoved = removed.filter((v) => v._count.orderItems > 0).map((v) => v.size);
  const toCreate = input.variants.filter((v) => !bySize.has(v.size));

  const toUpdate: { id: string; stock: number; expected: number }[] = [];
  const conflicts: string[] = [];
  for (const v of input.variants) {
    const cur = bySize.get(v.size);
    if (!cur) continue;
    if (v.expectedStock !== undefined) {
      if (v.stock === v.expectedStock) continue; // el admin no lo cambió
      if (cur.stock !== v.expectedStock) conflicts.push(v.size);
      else toUpdate.push({ id: cur.id, stock: v.stock, expected: v.expectedStock });
    } else if (cur.stock !== v.stock) {
      toUpdate.push({ id: cur.id, stock: v.stock, expected: cur.stock });
    }
  }
  if (conflicts.length) throw conflict(`la(s) talla(s) ${conflicts.join(", ")}`);

  const allSizes = sortSizes([...input.variants.map((v) => v.size), ...keptRemoved]);
  const hasSizesAfter = allSizes.length > 0;
  const variantWrites = toDelete.length + toZero.length + toUpdate.length + toCreate.length > 0;

  // Producto sin tallas: stock real del producto.
  let singleStock: { value: number; expected?: number } | undefined;
  if (!hasSizesAfter) {
    if (current.variants.length > 0) singleStock = { value: input.stock }; // pasa de tallas a stock único
    else if (input.expectedStock !== undefined) {
      if (input.stock !== input.expectedStock) {
        if (current.stock !== input.expectedStock) throw conflict("este producto");
        singleStock = { value: input.stock, expected: input.expectedStock };
      }
    } else if (input.stock !== current.stock) singleStock = { value: input.stock, expected: current.stock };
  }

  const data = { ...baseData(input), slug, categoryId, sizes: allSizes };
  const removedImages = current.images.filter((src) => !input.images.includes(src));

  // Camino rápido: sin cambios de inventario → una sola escritura, sin transacción interactiva.
  if (!variantWrites && !singleStock) {
    const product = await db.product.update({ where: { id }, data });
    return Object.assign(product, { removedImages });
  }

  const product = await db.$transaction(async (tx) => {
    if (toDelete.length) await tx.productVariant.deleteMany({ where: { id: { in: toDelete } } });
    if (toZero.length) await tx.productVariant.updateMany({ where: { id: { in: toZero } }, data: { stock: 0 } });
    for (const u of toUpdate) {
      const r = await tx.productVariant.updateMany({ where: { id: u.id, stock: u.expected }, data: { stock: u.stock } });
      if (r.count !== 1) throw conflict("una talla");
    }
    if (toCreate.length) await tx.productVariant.createMany({ data: toCreate.map((v) => ({ productId: id, size: v.size, stock: v.stock })) });

    let stock: number | undefined;
    if (hasSizesAfter && variantWrites) {
      const agg = await tx.productVariant.aggregate({ where: { productId: id }, _sum: { stock: true } });
      stock = agg._sum.stock ?? 0;
    } else if (singleStock) {
      if (singleStock.expected !== undefined) {
        const r = await tx.product.updateMany({ where: { id, stock: singleStock.expected }, data: { stock: singleStock.value } });
        if (r.count !== 1) throw conflict("este producto");
      } else stock = singleStock.value;
    }
    return tx.product.update({ where: { id }, data: { ...data, ...(stock !== undefined ? { stock } : {}) } });
  }, TX);
  return Object.assign(product, { removedImages });
}

export async function setProductActive(id: string, active: boolean, db: PrismaClient = prisma) {
  const p = await db.product.findUnique({ where: { id }, select: { id: true, category: { select: { active: true, label: true } } } });
  if (!p) throw new ProductError(404, "Producto no encontrado.");
  if (active && p.category && !p.category.active) throw new ProductError(409, `La categoría «${p.category.label}» está desactivada. Actívala primero.`);
  await db.product.update({ where: { id }, data: { active } });
}

/** Elimina físicamente SOLO si no tiene pedidos; de lo contrario obliga a desactivar. Devuelve sus imágenes para limpiarlas. */
export async function deleteProduct(id: string, db: PrismaClient = prisma) {
  return db.$transaction(async (tx) => {
    const p = await tx.product.findUnique({ where: { id }, select: { id: true, name: true, images: true } });
    if (!p) throw new ProductError(404, "Producto no encontrado.");
    const orders = await tx.orderItem.count({ where: { productId: id } });
    if (orders > 0) throw new ProductError(409, `Este producto tiene ${orders} línea(s) de pedidos. Para no romper el historial, desactívalo en lugar de eliminarlo.`);
    await tx.product.delete({ where: { id } });
    return p;
  }, TX);
}

/**
 * Ajuste rápido de inventario (conteo físico). Con `expectedStock` funciona como
 * "comparar y cambiar": si una compra modificó el stock mientras tanto, responde 409 en vez de sobrescribir.
 */
export async function setStock(id: string, input: StockInput, db: PrismaClient = prisma) {
  return db.$transaction(async (tx) => {
    const product = await tx.product.findUnique({ where: { id }, select: { id: true, stock: true, variants: { select: { id: true, stock: true, size: true } } } });
    if (!product) throw new ProductError(404, "Producto no encontrado.");
    if ("variants" in input) {
      if (product.variants.length === 0) throw new ProductError(400, "Este producto no maneja tallas.");
      const byId = new Map(product.variants.map((v) => [v.id, v]));
      let wrote = false;
      for (const v of input.variants) {
        const cur = byId.get(v.id);
        if (!cur) throw new ProductError(400, "Talla no pertenece al producto.");
        const expected = v.expectedStock ?? cur.stock;
        if (v.stock === expected && v.expectedStock !== undefined) continue;
        const r = await tx.productVariant.updateMany({ where: { id: v.id, stock: expected }, data: { stock: v.stock } });
        if (r.count !== 1) throw conflict(`la talla ${cur.size}`);
        wrote = true;
      }
      if (!wrote) return { id, stock: product.variants.reduce((n, v) => n + v.stock, 0), variants: product.variants };
      const variants = await tx.productVariant.findMany({ where: { productId: id }, select: { id: true, stock: true, size: true } });
      const total = variants.reduce((n, v) => n + v.stock, 0);
      await tx.product.update({ where: { id }, data: { stock: total } });
      return { id, stock: total, variants };
    }
    if (product.variants.length > 0) throw new ProductError(400, "Este producto maneja stock por talla.");
    const expected = input.expectedStock ?? product.stock;
    const r = await tx.product.updateMany({ where: { id, stock: expected }, data: { stock: input.stock } });
    if (r.count !== 1) throw conflict("este producto");
    return { id, stock: input.stock, variants: [] as { id: string; stock: number; size: string }[] };
  }, TX);
}
