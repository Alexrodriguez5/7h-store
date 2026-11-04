import type { CommunityCategory, Customer, ModerationStatus, PrismaClient } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { UgcError, deleteUgcPhotos, publicName, textProblem, uploadUgcPhoto } from "@/lib/ugc";

/**
 * Comunidad 7H (versión básica, ordenada y moderada):
 * - Publicar, comentar, reaccionar y reportar exige sesión con correo verificado.
 * - La PRIMERA publicación de cada cliente pasa por revisión; las siguientes salen de inmediato.
 * - Sin enlaces ni insultos; límites de frecuencia; con 3 reportes una publicación o comentario se oculta solo
 *   hasta que el equipo lo revise.
 */
export const CATEGORIES: Record<CommunityCategory, string> = {
  RECOMENDACIONES: "Recomendaciones",
  TECNOLOGIA: "Tecnología",
  MODA_ESTILO: "Moda y estilo",
  PRODUCTOS_QUE_BUSCAMOS: "Productos que buscamos",
  NOVEDADES: "Novedades",
  PREGUNTAS: "Preguntas y respuestas",
};
export const CATEGORY_SLUG: Record<CommunityCategory, string> = {
  RECOMENDACIONES: "recomendaciones", TECNOLOGIA: "tecnologia", MODA_ESTILO: "moda-y-estilo", PRODUCTOS_QUE_BUSCAMOS: "productos-que-buscamos", NOVEDADES: "novedades", PREGUNTAS: "preguntas",
};
export const categoryFromSlug = (s?: string) => (Object.entries(CATEGORY_SLUG).find(([, v]) => v === s)?.[0] as CommunityCategory | undefined);

export const REPORT_THRESHOLD = 3;

export const postInput = z.object({
  category: z.enum(Object.keys(CATEGORIES) as [CommunityCategory, ...CommunityCategory[]]),
  title: z.string().trim().min(5, "El título debe tener al menos 5 caracteres").max(120),
  body: z.string().trim().min(10, "Escribe un poco más").max(3000),
  alias: z.string().trim().max(40).optional().or(z.literal("")),
  website: z.string().max(200).optional(),
});
export const commentInput = z.object({
  body: z.string().trim().min(2, "Escribe tu comentario").max(1500),
  parentId: z.string().max(40).optional(),
  website: z.string().max(200).optional(),
});
export const reportInput = z.object({ postId: z.string().max(40).optional(), commentId: z.string().max(40).optional(), reason: z.string().trim().min(3).max(300) });

function check(...texts: string[]) {
  for (const t of texts) {
    const p = textProblem(t);
    if (p) throw new UgcError(400, p);
  }
}

export async function createPost(c: Customer, input: z.infer<typeof postInput>, photo: Uint8Array | null, db: PrismaClient = prisma) {
  if (input.website) throw new UgcError(400, "No pudimos publicar.");
  check(input.title, input.body, input.alias ?? "");
  const hasApproved = await db.communityPost.count({ where: { customerId: c.id, status: "APROBADA" } });
  let img: { path: string; mime: string } | null = null;
  try {
    if (photo) img = await uploadUgcPhoto("comunidad", photo);
    const status: ModerationStatus = hasApproved > 0 ? "APROBADA" : "PENDIENTE";
    const p = await db.communityPost.create({
      data: { customerId: c.id, category: input.category, title: input.title, body: input.body, displayName: publicName(input.alias, c.name), imagePath: img?.path ?? null, imageMime: img?.mime ?? null, status },
      select: { id: true, status: true },
    });
    return p;
  } catch (e) {
    if (img) await deleteUgcPhotos([img.path]);
    throw e;
  }
}

export async function addComment(c: Customer, postId: string, input: z.infer<typeof commentInput>, db: PrismaClient = prisma) {
  if (input.website) throw new UgcError(400, "No pudimos publicar.");
  check(input.body);
  const post = await db.communityPost.findFirst({ where: { id: postId, status: "APROBADA" }, select: { id: true } });
  if (!post) throw new UgcError(404, "Publicación no encontrada.");
  if (input.parentId) {
    const parent = await db.communityComment.findFirst({ where: { id: input.parentId, postId, parentId: null }, select: { id: true } });
    if (!parent) throw new UgcError(400, "No se puede responder a ese comentario.");
  }
  return db.communityComment.create({ data: { postId, customerId: c.id, parentId: input.parentId ?? null, displayName: publicName(undefined, c.name), body: input.body }, select: { id: true } });
}

export async function toggleReaction(customerId: string, postId: string, db: PrismaClient = prisma) {
  const post = await db.communityPost.findFirst({ where: { id: postId, status: "APROBADA" }, select: { id: true } });
  if (!post) throw new UgcError(404, "Publicación no encontrada.");
  const key = { postId_customerId: { postId, customerId } };
  const had = await db.communityReaction.findUnique({ where: key });
  if (had) await db.communityReaction.delete({ where: key });
  else await db.communityReaction.create({ data: { postId, customerId } });
  return { reacted: !had, count: await db.communityReaction.count({ where: { postId } }) };
}

/** Reporte de contenido. Con varios reportes abiertos, el contenido se oculta hasta que el equipo decida. */
export async function report(customerId: string, input: z.infer<typeof reportInput>, db: PrismaClient = prisma) {
  if (!input.postId === !input.commentId) throw new UgcError(400, "Reporte no válido.");
  const dup = await db.communityReport.findFirst({ where: { customerId, postId: input.postId ?? null, commentId: input.commentId ?? null, resolvedAt: null } });
  if (dup) return { ok: true };
  await db.communityReport.create({ data: { customerId, postId: input.postId ?? null, commentId: input.commentId ?? null, reason: input.reason } });
  const open = await db.communityReport.count({ where: { postId: input.postId ?? undefined, commentId: input.commentId ?? undefined, resolvedAt: null } });
  if (open >= REPORT_THRESHOLD) {
    if (input.postId) await db.communityPost.update({ where: { id: input.postId }, data: { status: "OCULTA" } });
    else await db.communityComment.update({ where: { id: input.commentId! }, data: { status: "OCULTA" } });
  }
  return { ok: true };
}

/** Moderación: cambia el estado y cierra los reportes abiertos de ese contenido. */
export async function moderatePost(id: string, status: ModerationStatus, db: PrismaClient = prisma) {
  await db.$transaction([
    db.communityPost.update({ where: { id }, data: { status } }),
    db.communityReport.updateMany({ where: { postId: id, resolvedAt: null }, data: { resolvedAt: new Date() } }),
  ]);
}
export async function moderateComment(id: string, status: ModerationStatus, db: PrismaClient = prisma) {
  await db.$transaction([
    db.communityComment.update({ where: { id }, data: { status } }),
    db.communityReport.updateMany({ where: { commentId: id, resolvedAt: null }, data: { resolvedAt: new Date() } }),
  ]);
}
