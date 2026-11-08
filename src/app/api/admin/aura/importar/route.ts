import { NextResponse } from "next/server";
import { audit } from "@/lib/admin/audit";
import { requireAdmin } from "@/lib/admin/guard";
import { CATEGORIES, importFile, invalidateLibrary, KnowledgeError } from "@/lib/aura/library/service";

export const runtime = "nodejs";
export const maxDuration = 60;
const MAX_BYTES = 3 * 1024 * 1024;

/** Importa un archivo TXT, Markdown, CSV o JSON. Todo entra "pendiente": nada llega al chat sin aprobación. */
export async function POST(req: Request) {
  const g = await requireAdmin(req);
  if (g.error) return g.error;
  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!form || !(file instanceof File)) return NextResponse.json({ error: "Adjunta un archivo." }, { status: 400 });
  if (file.size > MAX_BYTES) return NextResponse.json({ error: "El archivo supera 3 MB. Divídelo en partes." }, { status: 413 });
  const category = String(form.get("category") ?? "tienda");
  const source = String(form.get("source") ?? "").trim().slice(0, 200) || `Archivo ${file.name}`;
  if (!(CATEGORIES as readonly string[]).includes(category)) return NextResponse.json({ error: "Categoría no válida." }, { status: 400 });
  try {
    const text = new TextDecoder("utf-8", { fatal: false }).decode(await file.arrayBuffer());
    const r = await importFile(file.name, text, { category: category as (typeof CATEGORIES)[number], source, adminId: g.ctx.admin.id });
    invalidateLibrary();
    await audit({ action: "aura.knowledge.import", adminId: g.ctx.admin.id, actorEmail: g.ctx.admin.email, entityType: "knowledge", entityId: r.batch, ip: g.ctx.ip, details: { file: file.name, created: r.created, skipped: r.skipped } });
    return NextResponse.json(r, { status: 201 });
  } catch (e) {
    if (e instanceof KnowledgeError) return NextResponse.json({ error: e.message }, { status: e.status });
    if (e instanceof SyntaxError) return NextResponse.json({ error: "El JSON no es válido." }, { status: 400 });
    throw e;
  }
}
