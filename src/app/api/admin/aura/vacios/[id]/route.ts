import { NextResponse } from "next/server";
import { z } from "zod";
import { audit } from "@/lib/admin/audit";
import { requireAdmin } from "@/lib/admin/guard";
import { prisma } from "@/lib/prisma";
import { readJson } from "@/lib/request";

const input = z.object({ status: z.enum(["resuelta", "descartada", "pendiente"]) });

/** Marca una pregunta de "Aprendizaje y calidad" como resuelta o descartada. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const g = await requireAdmin(req);
  if (g.error) return g.error;
  const { id } = await params;
  const p = input.safeParse(await readJson(req));
  if (!p.success) return NextResponse.json({ error: "Datos no válidos" }, { status: 400 });
  await prisma.auraKnowledgeGap.update({ where: { id }, data: { status: p.data.status, resolvedById: g.ctx.admin.id } });
  await audit({ action: "aura.gap.status", adminId: g.ctx.admin.id, actorEmail: g.ctx.admin.email, entityType: "knowledge_gap", entityId: id, ip: g.ctx.ip, details: p.data });
  return NextResponse.json({ ok: true });
}
