import type { Customer, ModerationStatus, PrismaClient } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { isAllowedImageUrl } from "@/lib/images";
import { isAllowedVideoUrl } from "@/lib/schemas/admin";
import { UgcError, deleteUgcPhotos, isUgcPath, publicName, textProblem, uploadUgcPhoto } from "@/lib/ugc";

/**
 * "Así se vive 7H": galería de la tienda y de clientes.
 * - Contenido de la tienda: lo agrega el equipo (foto https permitida o video) y se publica de inmediato.
 * - Fotos de clientes: exigen autorización expresa, quedan PENDIENTES y solo se publican si el equipo las aprueba.
 * - El cliente puede retirar su foto cuando quiera: deja de mostrarse en el acto.
 */
export const customerMediaInput = z.object({
  caption: z.string().trim().max(140).optional().or(z.literal("")),
  alias: z.string().trim().max(40).optional().or(z.literal("")),
  productSlug: z.string().trim().max(100).regex(/^[a-z0-9-]*$/).optional().or(z.literal("")),
  consent: z.literal(true, { error: "Debes autorizar la publicación de tu foto." }),
  website: z.string().max(200).optional(),
});

export const storeMediaInput = z.object({
  kind: z.enum(["IMAGEN", "VIDEO"]),
  url: z.string().trim().max(600),
  caption: z.string().trim().max(140).optional().or(z.literal("")),
  productSlug: z.string().trim().max(100).optional().or(z.literal("")),
  featured: z.boolean().default(true),
}).refine((v) => (v.kind === "IMAGEN" ? isAllowedImageUrl(v.url) : isAllowedVideoUrl(v.url)), { message: "URL no permitida: usa una imagen subida a la tienda (o Unsplash) o un video de YouTube, Vimeo o .mp4.", path: ["url"] });

async function productIdFor(slug: string | undefined, db: PrismaClient) {
  if (!slug) return null;
  return (await db.product.findFirst({ where: { slug, active: true }, select: { id: true } }))?.id ?? null;
}

export async function submitCustomerMedia(customer: Customer, input: z.infer<typeof customerMediaInput>, photo: Uint8Array, db: PrismaClient = prisma) {
  if (input.website) throw new UgcError(400, "No pudimos enviar tu foto.");
  for (const t of [input.caption ?? "", input.alias ?? ""]) {
    const p = textProblem(t);
    if (p) throw new UgcError(400, p);
  }
  const pending = await db.mediaItem.count({ where: { customerId: customer.id, status: "PENDIENTE" } });
  if (pending >= 5) throw new UgcError(429, "Tienes varias fotos en revisión. Espera a que las revisemos.");
  const img = await uploadUgcPhoto("galeria", photo);
  try {
    return await db.mediaItem.create({
      data: {
        source: "customer", kind: "IMAGEN", customerId: customer.id, path: img.path, mime: img.mime, caption: input.caption || null,
        displayName: publicName(input.alias, customer.name), productId: await productIdFor(input.productSlug || undefined, db), consentAt: new Date(),
      },
      select: { id: true },
    });
  } catch (e) {
    await deleteUgcPhotos([img.path]);
    throw e;
  }
}

export async function createStoreMedia(input: z.infer<typeof storeMediaInput>, db: PrismaClient = prisma) {
  return db.mediaItem.create({
    data: { source: "store", kind: input.kind, path: input.url, caption: input.caption || null, featured: input.featured, status: "APROBADA", productId: await productIdFor(input.productSlug || undefined, db) },
    select: { id: true },
  });
}

/** El cliente retira su foto: se oculta de inmediato y se borra el archivo. */
export async function withdrawMedia(customerId: string, id: string, db: PrismaClient = prisma) {
  const m = await db.mediaItem.findFirst({ where: { id, customerId }, select: { id: true, path: true } });
  if (!m) throw new UgcError(404, "No encontrada.");
  await db.mediaItem.update({ where: { id }, data: { withdrawnAt: new Date(), status: "OCULTA" } });
  if (isUgcPath(m.path)) await deleteUgcPhotos([m.path]);
}

export async function moderateMedia(id: string, status: ModerationStatus, db: PrismaClient = prisma) {
  const m = await db.mediaItem.update({ where: { id }, data: { status }, select: { path: true, source: true } });
  if (status === "RECHAZADA" && m.source === "customer" && isUgcPath(m.path)) await deleteUgcPhotos([m.path]);
}

export interface PublicMedia { id: string; kind: "IMAGEN" | "VIDEO"; src: string; caption: string | null; displayName: string | null; source: string; product: { name: string; slug: string } | null }

/** Lo que el público puede ver: aprobado, no retirado. Las fotos de clientes se sirven por /media/galeria. */
export async function getPublicMedia(opts: { featuredOnly?: boolean; take?: number } = {}, db: PrismaClient = prisma): Promise<PublicMedia[]> {
  const rows = await db.mediaItem.findMany({
    where: { status: "APROBADA", withdrawnAt: null, ...(opts.featuredOnly ? { featured: true } : {}) },
    orderBy: [{ featured: "desc" }, { createdAt: "desc" }],
    take: opts.take ?? 24,
    select: { id: true, kind: true, path: true, caption: true, displayName: true, source: true, product: { select: { name: true, slug: true, active: true } } },
  });
  return rows.map((r) => ({
    id: r.id, kind: r.kind, caption: r.caption, displayName: r.displayName, source: r.source,
    src: r.source === "customer" ? `/media/galeria/${r.id}` : r.path,
    product: r.product?.active ? { name: r.product.name, slug: r.product.slug } : null,
  }));
}
