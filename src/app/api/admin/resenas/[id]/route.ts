import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/admin/guard";
import { audit } from "@/lib/admin/audit";
import { prisma } from "@/lib/prisma";
import { readJson } from "@/lib/request";
import { moderateReview } from "@/lib/services/reviews";
import { deleteUgcPhotos } from "@/lib/ugc";

const schema = z.object({
  status: z.enum(["PENDIENTE", "APROBADA", "RECHAZADA", "OCULTA"]),
  note: z.string().trim().max(300).optional(),
});

/** Aprobar, ocultar o rechazar una reseña. */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const g = await requireAdmin(req);
  if (g.error) return g.error;
  const parsed = schema.safeParse(await readJson(req));
  if (!parsed.success) return NextResponse.json({ error: "Datos no válidos" }, { status: 400 });
  const { id } = await params;
  try {
    await moderateReview(id, parsed.data.status, parsed.data.note || null);
  } catch {
    return NextResponse.json({ error: "Reseña no encontrada." }, { status: 404 });
  }
  await audit({ action: "review.moderated", adminId: g.ctx.admin.id, actorEmail: g.ctx.admin.email, entityType: "review", entityId: id, details: { status: parsed.data.status }, ip: g.ctx.ip });
  return NextResponse.json({ ok: true });
}

/** Eliminar definitivamente (spam o contenido ilegal). */
export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const g = await requireAdmin(req);
  if (g.error) return g.error;
  const { id } = await params;
  const r = await prisma.review.findUnique({ where: { id }, select: { photos: { select: { path: true } } } });
  if (!r) return NextResponse.json({ error: "Reseña no encontrada." }, { status: 404 });
  await prisma.review.delete({ where: { id } });
  await deleteUgcPhotos(r.photos.map((p) => p.path));
  await audit({ action: "review.deleted", adminId: g.ctx.admin.id, actorEmail: g.ctx.admin.email, entityType: "review", entityId: id, ip: g.ctx.ip });
  return NextResponse.json({ ok: true });
}
