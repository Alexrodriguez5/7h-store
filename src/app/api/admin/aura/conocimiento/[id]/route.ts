import { NextResponse } from "next/server";
import { z } from "zod";
import { audit } from "@/lib/admin/audit";
import { requireAdmin } from "@/lib/admin/guard";
import { entryInput, KnowledgeError, setEntryStatus, setQuestionStatus, updateEntry } from "@/lib/aura/library/service";
import { readJson } from "@/lib/request";

const action = z.discriminatedUnion("action", [
  z.object({ action: z.literal("edit"), data: entryInput }),
  z.object({ action: z.literal("status"), status: z.enum(["aprobada", "desactivada", "pendiente"]), includeSynthetic: z.boolean().default(false) }),
  z.object({ action: z.literal("question"), questionId: z.string().min(1).max(40), status: z.enum(["aprobada", "desactivada"]) }),
]);

/** Editar, aprobar, desactivar una entrada o aprobar/desactivar una de sus preguntas. Todo queda en auditoría. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const g = await requireAdmin(req);
  if (g.error) return g.error;
  const { id } = await params;
  const p = action.safeParse(await readJson(req));
  if (!p.success) return NextResponse.json({ error: p.error.issues[0]?.message ?? "Datos no válidos" }, { status: 400 });
  try {
    if (p.data.action === "edit") await updateEntry(id, p.data.data, g.ctx.admin.id);
    else if (p.data.action === "status") await setEntryStatus(id, p.data.status, g.ctx.admin.id, { includeSynthetic: p.data.includeSynthetic });
    else await setQuestionStatus(p.data.questionId, p.data.status);
    await audit({ action: `aura.knowledge.${p.data.action}`, adminId: g.ctx.admin.id, actorEmail: g.ctx.admin.email, entityType: "knowledge", entityId: id, ip: g.ctx.ip, details: p.data.action === "status" ? { status: p.data.status } : undefined });
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof KnowledgeError) return NextResponse.json({ error: e.message }, { status: e.status });
    throw e;
  }
}
