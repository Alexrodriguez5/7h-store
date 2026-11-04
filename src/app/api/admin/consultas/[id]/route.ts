import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/admin/guard";
import { audit } from "@/lib/admin/audit";
import { readJson } from "@/lib/request";
import { staffReply } from "@/lib/services/inquiries";
import { UgcError } from "@/lib/ugc";

const schema = z.object({ status: z.enum(["ABIERTA", "RESPONDIDA", "CERRADA"]).optional(), reply: z.string().trim().min(2).max(2000).optional() });

/** Responder una consulta (llega al cliente por correo) o cambiar su estado. */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const g = await requireAdmin(req);
  if (g.error) return g.error;
  const parsed = schema.safeParse(await readJson(req));
  if (!parsed.success) return NextResponse.json({ error: "Datos no válidos" }, { status: 400 });
  const { id } = await params;
  try {
    const q = await staffReply(id, g.ctx.admin.id, parsed.data);
    await audit({ action: parsed.data.reply ? "inquiry.replied" : "inquiry.status_changed", adminId: g.ctx.admin.id, actorEmail: g.ctx.admin.email, entityType: "inquiry", entityId: q.code, details: { status: parsed.data.status }, ip: g.ctx.ip });
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof UgcError) return NextResponse.json({ error: e.message }, { status: e.status });
    return NextResponse.json({ error: "No se pudo guardar." }, { status: 500 });
  }
}
