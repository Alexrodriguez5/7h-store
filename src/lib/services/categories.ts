import type { PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { CategoryCreateInput, CategoryUpdateInput } from "@/lib/schemas/admin";

export class CategoryError extends Error {
  constructor(public status: 400 | 404 | 409, message: string) { super(message); }
}

/** Categorías con conteo de productos (total y activos) para el panel. */
export async function listCategoriesAdmin(db: PrismaClient = prisma) {
  const [cats, activeCounts] = await Promise.all([
    db.category.findMany({ orderBy: [{ sortOrder: "asc" }, { label: "asc" }], include: { _count: { select: { products: true } } } }),
    db.product.groupBy({ by: ["categoryId"], where: { active: true }, _count: { _all: true } }),
  ]);
  const active = new Map(activeCounts.map((g) => [g.categoryId, g._count._all]));
  return cats.map((c) => ({ ...c, productCount: c._count.products, activeProductCount: active.get(c.id) ?? 0 }));
}

export async function createCategory(input: CategoryCreateInput, db: PrismaClient = prisma) {
  if (await db.category.findUnique({ where: { slug: input.slug }, select: { id: true } })) {
    throw new CategoryError(409, `Ya existe una categoría con el slug «${input.slug}».`);
  }
  const dup = await db.category.findFirst({ where: { label: { equals: input.label, mode: "insensitive" } }, select: { id: true } });
  if (dup) throw new CategoryError(409, `Ya existe una categoría llamada «${input.label}».`);
  let sortOrder = input.sortOrder;
  if (sortOrder === undefined) {
    const last = await db.category.findFirst({ orderBy: { sortOrder: "desc" }, select: { sortOrder: true } });
    sortOrder = (last?.sortOrder ?? 0) + 10;
  }
  return db.category.create({ data: { slug: input.slug, label: input.label, sortOrder, imageUrl: input.imageUrl ?? null, active: true } });
}

export async function updateCategory(id: string, input: CategoryUpdateInput, db: PrismaClient = prisma) {
  return db.$transaction(async (tx) => {
    const current = await tx.category.findUnique({ where: { id } });
    if (!current) throw new CategoryError(404, "Categoría no encontrada.");
    if (input.label && input.label.toLowerCase() !== current.label.toLowerCase()) {
      const dup = await tx.category.findFirst({ where: { label: { equals: input.label, mode: "insensitive" }, id: { not: id } }, select: { id: true } });
      if (dup) throw new CategoryError(409, `Ya existe una categoría llamada «${input.label}».`);
    }
    if (input.active === false && current.active) {
      // Nunca dejar productos visibles en una categoría oculta.
      const activeProducts = await tx.product.count({ where: { categoryId: id, active: true } });
      if (activeProducts > 0) {
        throw new CategoryError(409, `«${current.label}» tiene ${activeProducts} producto(s) activo(s). Desactívalos o muévelos a otra categoría antes de ocultarla.`);
      }
    }
    return tx.category.update({
      where: { id },
      data: {
        ...(input.label !== undefined ? { label: input.label } : {}),
        ...(input.sortOrder !== undefined ? { sortOrder: input.sortOrder } : {}),
        ...(input.imageUrl !== undefined ? { imageUrl: input.imageUrl } : {}),
        ...(input.active !== undefined ? { active: input.active } : {}),
      },
    });
  }, { maxWait: 10_000, timeout: 15_000 });
}

/** Solo se elimina una categoría vacía: no se dejan productos huérfanos ni se rompen sus URLs. */
export async function deleteCategory(id: string, db: PrismaClient = prisma) {
  return db.$transaction(async (tx) => {
    const current = await tx.category.findUnique({ where: { id }, select: { id: true, label: true } });
    if (!current) throw new CategoryError(404, "Categoría no encontrada.");
    const products = await tx.product.count({ where: { categoryId: id } });
    if (products > 0) throw new CategoryError(409, `«${current.label}» tiene ${products} producto(s). Muévelos a otra categoría o desactiva la categoría en lugar de eliminarla.`);
    await tx.category.delete({ where: { id } });
    return current;
  }, { maxWait: 10_000, timeout: 15_000 });
}

/** Opciones para el formulario de productos (incluye las ocultas, marcadas). */
export const listCategoryOptions = (db: PrismaClient = prisma) =>
  db.category.findMany({ select: { slug: true, label: true, active: true }, orderBy: [{ active: "desc" }, { sortOrder: "asc" }, { label: "asc" }] });
