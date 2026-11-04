import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin/guard";
import { audit } from "@/lib/admin/audit";
import { readJson } from "@/lib/request";
import { createStoreMedia, storeMediaInput } from "@/lib/services/gallery";

/** El equipo agrega contenido propio a la galería (foto o video). */
export async function POST(req: Request) {
  const g = await requireAdmin(req);
  if (g.error) return g.error;
  const parsed = storeMediaInput.safeParse(await readJson(req));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Datos no válidos" }, { status: 400 });
  const m = await createStoreMedia(parsed.data);
  await audit({ action: "media.created", adminId: g.ctx.admin.id, actorEmail: g.ctx.admin.email, entityType: "media", entityId: m.id, ip: g.ctx.ip });
  return NextResponse.json(m, { status: 201 });
}
