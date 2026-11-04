import type { Customer, ModerationStatus, PrismaClient } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { customerOrdersWhere } from "@/lib/services/support";
import { MAX_UGC_PHOTOS, UgcError, deleteUgcPhotos, publicName, textProblem, uploadUgcPhoto } from "@/lib/ugc";

/** Pedidos que cuentan como compra real: pagados o más adelante (nunca pendientes, vencidos ni cancelados). */
export const PURCHASED_STATUSES = ["PAID", "PROCESSING", "SHIPPED", "DELIVERED"] as const;

export const reviewInput = z.object({
  rating: z.number().int().min(1, "Elige de 1 a 5 estrellas").max(5, "Elige de 1 a 5 estrellas"),
  title: z.string().trim().max(80).optional().or(z.literal("")),
  body: z.string().trim().min(15, "Cuéntanos un poco más (mínimo 15 caracteres)").max(2000, "Máximo 2.000 caracteres"),
  alias: z.string().trim().max(40).optional().or(z.literal("")),
  /** Campo trampa: los humanos no lo ven. Si viene lleno, es un robot. */
  website: z.string().max(200).optional(),
});
export type ReviewInput = z.infer<typeof reviewInput>;

/** ¿El cliente compró (y pagó) este producto con su correo verificado? Lo decide SOLO el servidor. */
export async function isVerifiedBuyer(c: Pick<Customer, "email" | "emailVerifiedAt">, productId: string, db: PrismaClient = prisma) {
  if (!c.emailVerifiedAt) return false;
  const hit = await db.order.findFirst({
    where: { ...customerOrdersWhere(c), status: { in: [...PURCHASED_STATUSES] }, items: { some: { productId } } },
    select: { id: true },
  });
  return !!hit;
}

/**
 * Crea la reseña en estado PENDIENTE (no se publica hasta que el equipo la apruebe).
 * Una reseña por cliente y producto; si ya existe, se actualiza y vuelve a moderación.
 */
export async function submitReview(customer: Customer, productId: string, input: ReviewInput, photos: Uint8Array[], db: PrismaClient = prisma) {
  if (input.website) throw new UgcError(400, "No pudimos enviar tu reseña.");
  for (const t of [input.title ?? "", input.body, input.alias ?? ""]) {
    const problem = textProblem(t);
    if (problem) throw new UgcError(400, problem);
  }
  if (photos.length > MAX_UGC_PHOTOS) throw new UgcError(400, `Puedes adjuntar hasta ${MAX_UGC_PHOTOS} fotos.`);

  const product = await db.product.findFirst({ where: { id: productId, active: true }, select: { id: true, slug: true } });
  if (!product) throw new UgcError(404, "Producto no encontrado.");

  const verified = await isVerifiedBuyer(customer, productId, db);
  // Las fotos se suben primero; si la base de datos falla, se borran para no dejar archivos sueltos.
  const uploaded: { path: string; mime: string }[] = [];
  try {
    for (const p of photos) uploaded.push(await uploadUgcPhoto("resenas", p));
    const data = {
      rating: input.rating,
      title: input.title || null,
      body: input.body,
      displayName: publicName(input.alias, customer.name),
      verified,
      status: "PENDIENTE" as const,
      moderationNote: null,
    };
    const existing = await db.review.findUnique({ where: { productId_customerId: { productId, customerId: customer.id } }, select: { id: true, photos: { select: { path: true } } } });
    if (existing) {
      await db.$transaction([
        db.reviewPhoto.deleteMany({ where: { reviewId: existing.id } }),
        db.review.update({ where: { id: existing.id }, data: { ...data, photos: { create: uploaded.map((u, i) => ({ ...u, position: i })) } } }),
      ]);
      await deleteUgcPhotos(existing.photos.map((p) => p.path));
      return { id: existing.id, verified, updated: true };
    }
    const r = await db.review.create({ data: { ...data, productId, customerId: customer.id, photos: { create: uploaded.map((u, i) => ({ ...u, position: i })) } }, select: { id: true } });
    return { id: r.id, verified, updated: false };
  } catch (e) {
    await deleteUgcPhotos(uploaded.map((u) => u.path));
    throw e;
  }
}

/** Marca o desmarca "útil". El contador se recalcula desde los votos (no se puede inflar). */
export async function toggleHelpful(customerId: string, reviewId: string, db: PrismaClient = prisma) {
  const review = await db.review.findFirst({ where: { id: reviewId, status: "APROBADA" }, select: { id: true, customerId: true } });
  if (!review) throw new UgcError(404, "Reseña no encontrada.");
  if (review.customerId === customerId) throw new UgcError(400, "No puedes votar tu propia reseña.");
  const key = { reviewId_customerId: { reviewId, customerId } };
  const had = await db.reviewVote.findUnique({ where: key });
  if (had) await db.reviewVote.delete({ where: key });
  else await db.reviewVote.create({ data: { reviewId, customerId } });
  const count = await db.reviewVote.count({ where: { reviewId } });
  await db.review.update({ where: { id: reviewId }, data: { helpfulCount: count } });
  return { voted: !had, helpfulCount: count };
}

export interface PublicReview {
  id: string; rating: number; title: string | null; body: string; displayName: string; verified: boolean;
  helpfulCount: number; createdAt: string; photos: { id: string }[];
}

/** Reseñas APROBADAS de un producto (lo único que ve el público) y su resumen. */
export async function getProductReviews(productId: string, db: PrismaClient = prisma) {
  const rows = await db.review.findMany({
    where: { productId, status: "APROBADA" },
    orderBy: { createdAt: "desc" },
    take: 200,
    select: { id: true, rating: true, title: true, body: true, displayName: true, verified: true, helpfulCount: true, createdAt: true, photos: { select: { id: true }, orderBy: { position: "asc" } } },
  });
  const reviews: PublicReview[] = rows.map((r) => ({ ...r, createdAt: r.createdAt.toISOString() }));
  const count = reviews.length;
  const average = count ? reviews.reduce((n, r) => n + r.rating, 0) / count : 0;
  const histogram = [5, 4, 3, 2, 1].map((stars) => ({ stars, count: reviews.filter((r) => r.rating === stars).length }));
  return { reviews, count, average, histogram };
}

/** Moderación desde el panel. Al rechazar se borran las fotos del almacenamiento. */
export async function moderateReview(id: string, status: ModerationStatus, note: string | null, db: PrismaClient = prisma) {
  const r = await db.review.update({ where: { id }, data: { status, moderationNote: note }, select: { id: true, productId: true, photos: { select: { path: true } } } });
  if (status === "RECHAZADA") {
    await deleteUgcPhotos(r.photos.map((p) => p.path));
    await db.reviewPhoto.deleteMany({ where: { reviewId: id } });
  }
  return r;
}
