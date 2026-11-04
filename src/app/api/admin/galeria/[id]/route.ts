import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/admin/guard";
import { audit } from "@/lib/admin/audit";
import { prisma } from "@/lib/prisma";
import { readJson } from "@/lib/request";
import { moderateMedia } from "@/lib/services/gallery";
import { deleteUgcPhotos, isUgcPath } from "@/lib/ugc";

const schema = z.object({ status: z.enum(["PENDIENTE", "APROBADA", "RECHAZADA", "OCULTA"]).optional(), featured: z.boolean().optional(), note: z.string().max(300).optional() });

/** Aprobar, ocultar, rechazar o destacar en la portada. */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const g = await requireAdmin(req);
  if (g.error) return g.error;
  const parsed = schema.safeParse(await readJson(req));
  if (!parsed.success) return NextResponse.json({ error: "Datos no válidos" }, { status: 400 });
  const { id } = await params;
  try {
    if (parsed.data.status) await moderateMedia(id, parsed.data.status);
    if (parsed.data.featured !== undefined) await prisma.mediaItem.update({ where: { id }, data: { featured: parsed.data.featured } });
  } catch {
    return NextResponse.json({ error: "No encontrado." }, { status: 404 });
  }
  await audit({ action: "media.moderated", adminId: g.ctx.admin.id, actorEmail: g.ctx.admin.email, entityType: "media", entityId: id, details: { status: parsed.data.status, featured: parsed.data.featured }, ip: g.ctx.ip });
  return NextResponse.json({ ok: true });
}

/** Eliminar definitivamente (también borra el archivo si es de un cliente). */
export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const g = await requireAdmin(req);
  if (g.error) return g.error;
  const { id } = await params;
  const m = await prisma.mediaItem.findUnique({ where: { id }, select: { path: true } });
  if (!m) return NextResponse.json({ error: "No encontrado." }, { status: 404 });
  await prisma.mediaItem.delete({ where: { id } });
  if (isUgcPath(m.path)) await deleteUgcPhotos([m.path]);
  await audit({ action: "media.moderated", adminId: g.ctx.admin.id, actorEmail: g.ctx.admin.email, entityType: "media", entityId: id, details: { deleted: true }, ip: g.ctx.ip });
  return NextResponse.json({ ok: true });
}
