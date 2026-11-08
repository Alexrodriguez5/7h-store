import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/admin/guard";
import { buildIndex, matchQuestion } from "@/lib/aura/library/match";
import { approvedDocs, renderBody } from "@/lib/aura/library/service";
import { prisma } from "@/lib/prisma";
import { readJson } from "@/lib/request";

const input = z.object({ question: z.string().trim().min(1).max(300), incluirPendientes: z.boolean().default(false) });

/** "Probar": muestra qué respondería la biblioteca, con puntajes. Con pendientes incluidas, sirve para revisar antes de aprobar. */
export async function POST(req: Request) {
  const g = await requireAdmin(req);
  if (g.error) return g.error;
  const p = input.safeParse(await readJson(req));
  if (!p.success) return NextResponse.json({ error: "Escribe una pregunta." }, { status: 400 });
  let index = (await approvedDocs()).index;
  if (p.data.incluirPendientes) {
    const rows = await prisma.knowledgeEntry.findMany({ where: { kind: "qa", status: { in: ["aprobada", "pendiente"] } }, select: { id: true, category: true, title: true, body: true, questions: { where: { status: { not: "desactivada" } }, select: { text: true } } }, take: 5000 });
    index = buildIndex(rows.map((r) => ({ id: r.id, category: r.category, title: r.title, body: r.body, questions: r.questions.map((q) => q.text) })));
  }
  const r = matchQuestion(index, p.data.question);
  return NextResponse.json({
    decision: r.decision, understood: r.understood,
    candidates: r.candidates.map((c) => ({ id: c.doc.id, title: c.doc.title, score: +c.score.toFixed(3), coverage: +c.coverage.toFixed(2), answer: renderBody(c.doc.body) })),
  });
}
