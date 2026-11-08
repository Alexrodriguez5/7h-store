import { NextResponse } from "next/server";
import { audit } from "@/lib/admin/audit";
import { requireAdmin } from "@/lib/admin/guard";
import { approveBatch, approvePendingSynthetic, createEntry, entryInput, importSeed, invalidateLibrary, KnowledgeError } from "@/lib/aura/library/service";
import { readJson } from "@/lib/request";

/** Crea una entrada (queda pendiente) o carga el conocimiento inicial de la tienda ({ "semilla": true }). */
export async function POST(req: Request) {
  const g = await requireAdmin(req);
  if (g.error) return g.error;
  const body = (await readJson(req)) as Record<string, unknown> | undefined;
  try {
    if (body?.semilla === true) {
      const r = await importSeed(g.ctx.admin.id);
      await audit({ action: "aura.knowledge.seed", adminId: g.ctx.admin.id, actorEmail: g.ctx.admin.email, entityType: "knowledge", entityId: "semilla", ip: g.ctx.ip, details: r });
      return NextResponse.json(r, { status: 201 });
    }
    if (body?.aprobarSinteticas === true) {
      const r = await approvePendingSynthetic();
      await audit({ action: "aura.knowledge.synthetic_approved", adminId: g.ctx.admin.id, actorEmail: g.ctx.admin.email, entityType: "knowledge", entityId: "sinteticas", ip: g.ctx.ip, details: r });
      return NextResponse.json(r);
    }
    if (typeof body?.aprobarLote === "string" && body.aprobarLote.length <= 120) {
      const r = await approveBatch(body.aprobarLote, g.ctx.admin.id, body.incluirSinteticas === true);
      await audit({ action: "aura.knowledge.batch_approved", adminId: g.ctx.admin.id, actorEmail: g.ctx.admin.email, entityType: "knowledge", entityId: body.aprobarLote, ip: g.ctx.ip, details: { ...r, incluirSinteticas: body.incluirSinteticas === true } });
      return NextResponse.json(r);
    }
    const p = entryInput.safeParse(body);
    if (!p.success) return NextResponse.json({ error: p.error.issues[0]?.message ?? "Datos no válidos" }, { status: 400 });
    const e = await createEntry(p.data, { adminId: g.ctx.admin.id });
    invalidateLibrary();
    await audit({ action: "aura.knowledge.created", adminId: g.ctx.admin.id, actorEmail: g.ctx.admin.email, entityType: "knowledge", entityId: e.id, ip: g.ctx.ip });
    return NextResponse.json(e, { status: 201 });
  } catch (e) {
    if (e instanceof KnowledgeError) return NextResponse.json({ error: e.message }, { status: e.status });
    throw e;
  }
}
