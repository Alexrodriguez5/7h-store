import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/admin/guard";
import { audit } from "@/lib/admin/audit";
import { prisma } from "@/lib/prisma";
import { readJson } from "@/lib/request";
import { moderateComment, moderatePost } from "@/lib/services/community";
import { deleteUgcPhotos } from "@/lib/ugc";

const schema = z.object({
  status: z.enum(["PENDIENTE", "APROBADA", "RECHAZADA", "OCULTA"]).optional(),
  note: z.string().max(300).optional(),
  pinned: z.boolean().optional(),
  /** Respuesta oficial de 7H STORE en una publicación. */
  reply: z.string().trim().min(2).max(1500).optional(),
});

type Kind = "publicaciones" | "comentarios";

/** Moderar publicaciones o comentarios, fijar publicaciones y responder como 7H STORE. */
export async function PATCH(req: Request, { params }: { params: Promise<{ kind: string; id: string }> }) {
  const g = await requireAdmin(req);
  if (g.error) return g.error;
  const { kind, id } = (await params) as { kind: Kind; id: string };
  if (kind !== "publicaciones" && kind !== "comentarios") return NextResponse.json({ error: "No encontrado." }, { status: 404 });
  const parsed = schema.safeParse(await readJson(req));
  if (!parsed.success) return NextResponse.json({ error: "Datos no válidos" }, { status: 400 });
  try {
    if (kind === "publicaciones") {
      if (parsed.data.status) await moderatePost(id, parsed.data.status);
      if (parsed.data.pinned !== undefined) await prisma.communityPost.update({ where: { id }, data: { pinned: parsed.data.pinned } });
      if (parsed.data.reply) await prisma.communityComment.create({ data: { postId: id, adminId: g.ctx.admin.id, displayName: "7H STORE", body: parsed.data.reply } });
    } else if (parsed.data.status) {
      await moderateComment(id, parsed.data.status);
    }
  } catch {
    return NextResponse.json({ error: "No encontrado." }, { status: 404 });
  }
  await audit({ action: "community.moderated", adminId: g.ctx.admin.id, actorEmail: g.ctx.admin.email, entityType: kind, entityId: id, details: { status: parsed.data.status, pinned: parsed.data.pinned, replied: !!parsed.data.reply }, ip: g.ctx.ip });
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request, { params }: { params: Promise<{ kind: string; id: string }> }) {
  const g = await requireAdmin(req);
  if (g.error) return g.error;
  const { kind, id } = await params;
  try {
    if (kind === "publicaciones") {
      const p = await prisma.communityPost.delete({ where: { id }, select: { imagePath: true } });
      if (p.imagePath) await deleteUgcPhotos([p.imagePath]);
    } else if (kind === "comentarios") {
      await prisma.communityComment.delete({ where: { id } });
    } else {
      return NextResponse.json({ error: "No encontrado." }, { status: 404 });
    }
  } catch {
    return NextResponse.json({ error: "No encontrado." }, { status: 404 });
  }
  await audit({ action: "community.moderated", adminId: g.ctx.admin.id, actorEmail: g.ctx.admin.email, entityType: kind, entityId: id, details: { deleted: true }, ip: g.ctx.ip });
  return NextResponse.json({ ok: true });
}
