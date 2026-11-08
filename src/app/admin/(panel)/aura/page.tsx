import Link from "next/link";
import { requireAdminPage } from "@/lib/admin/guard";
import { CATEGORIES } from "@/lib/aura/library/service";
import { SEED_VERSION } from "@/lib/aura/library/seed";
import { prisma } from "@/lib/prisma";
import { Badge, Card, PageHeader, Stat, fmtDate, tdCls, thCls } from "@/components/admin/ui";
import { BrainActions, EntryRowActions, GapActions, TestBox } from "@/components/admin/AuraBrain";

export const metadata = { title: "Cerebro de AURA" };

const TABS = [["conocimiento", "Cerebro de AURA"], ["calidad", "Aprendizaje y calidad"], ["probar", "Probar"]] as const;
const statusTone = { aprobada: "success", pendiente: "warning", borrador: "neutral", desactivada: "error" } as const;

export default async function AuraBrainPage({ searchParams }: { searchParams: Promise<{ tab?: string; estado?: string; categoria?: string; q?: string; p?: string }> }) {
  await requireAdminPage();
  const sp = await searchParams;
  const tab = TABS.some(([t]) => t === sp.tab) ? sp.tab! : "conocimiento";
  const tablesReady = await prisma.knowledgeEntry.count().then(() => true).catch(() => false);

  return (
    <>
      <PageHeader title="Cerebro de AURA" subtitle="Lo que AURA responde sin IA: solo conocimiento aprobado por el equipo. Nada se aprende solo." />
      <nav className="mb-6 flex flex-wrap gap-2">
        {TABS.map(([t, label]) => (
          <Link key={t} href={`/admin/aura?tab=${t}`} className={`rounded-full px-4 py-2 text-sm ${tab === t ? "bg-ink text-ivory" : "border border-ink/15 hover:border-gold"}`}>{label}</Link>
        ))}
      </nav>
      {!tablesReady ? (
        <Card title="Falta preparar la base de datos">
          <p className="text-sm">Ejecuta <code>docs/MIGRACION-AURA-CEREBRO.sql</code> en Supabase (SQL Editor). Solo agrega tablas nuevas.</p>
        </Card>
      ) : tab === "calidad" ? (
        <Quality />
      ) : tab === "probar" ? (
        <Card title="Probar la biblioteca"><TestBox /></Card>
      ) : (
        <Knowledge sp={sp} />
      )}
    </>
  );
}

async function Knowledge({ sp }: { sp: { estado?: string; categoria?: string; q?: string; p?: string } }) {
  const page = Math.max(1, Number(sp.p) || 1);
  const where = {
    ...(sp.estado ? { status: sp.estado } : {}),
    ...(sp.categoria ? { category: sp.categoria } : {}),
    ...(sp.q ? { searchText: { contains: sp.q.toLowerCase().normalize("NFD").replace(/\p{M}/gu, "") } } : {}),
  };
  const seedName = `semilla-${SEED_VERSION}`;
  const [counts, rows, total, flagged, synthetic, seedPending] = await Promise.all([
    prisma.knowledgeEntry.groupBy({ by: ["status"], _count: true }),
    prisma.knowledgeEntry.findMany({
      where, orderBy: [{ status: "asc" }, { updatedAt: "desc" }], skip: (page - 1) * 30, take: 30,
      select: { id: true, kind: true, title: true, body: true, category: true, status: true, source: true, version: true, synthetic: true, duplicateOfId: true, conflictWithId: true, reviewAt: true, hits: true, updatedAt: true, questions: { select: { id: true, text: true, synthetic: true, status: true } } },
    }),
    prisma.knowledgeEntry.count({ where }),
    prisma.knowledgeEntry.count({ where: { status: { not: "desactivada" }, OR: [{ duplicateOfId: { not: null } }, { conflictWithId: { not: null } }] } }),
    prisma.knowledgeQuestion.count({ where: { synthetic: true, status: "pendiente" } }),
    prisma.knowledgeEntry.count({ where: { batch: seedName, status: "pendiente", duplicateOfId: null, conflictWithId: null } }),
  ]);
  const syntheticOfApproved = await prisma.knowledgeQuestion.count({ where: { synthetic: true, status: "pendiente", entry: { status: "aprobada" } } });
  const c = (s: string) => counts.find((x) => x.status === s)?._count ?? 0;
  const qs = (patch: Record<string, string | undefined>) => `/admin/aura?${new URLSearchParams(Object.entries({ estado: sp.estado, categoria: sp.categoria, q: sp.q, ...patch }).filter(([, v]) => v) as [string, string][]).toString()}`;

  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-5">
        <Stat label="Aprobadas (en uso)" value={c("aprobada")} href={qs({ estado: "aprobada", p: undefined })} />
        <Stat label="Pendientes de revisión" value={c("pendiente")} href={qs({ estado: "pendiente", p: undefined })} tone={c("pendiente") ? "warn" : undefined} />
        <Stat label="Desactivadas" value={c("desactivada")} href={qs({ estado: "desactivada", p: undefined })} />
        <Stat label="Posibles duplicados o contradicciones" value={flagged} tone={flagged ? "warn" : undefined} />
        <Stat label="Preguntas sintéticas por aprobar" value={synthetic} />
      </div>
      <BrainActions categories={[...CATEGORIES]} seedBatch={{ name: seedName, pending: seedPending }} syntheticPending={syntheticOfApproved} />
      <form className="flex flex-wrap gap-2" action="/admin/aura">
        <input name="q" defaultValue={sp.q} placeholder="Buscar en la biblioteca" className="rounded-lg border border-ink/15 bg-white px-3 py-2 text-sm" />
        <select name="estado" defaultValue={sp.estado ?? ""} className="rounded-lg border border-ink/15 bg-white px-3 py-2 text-sm">
          <option value="">Todos los estados</option>{["pendiente", "aprobada", "desactivada", "borrador"].map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <select name="categoria" defaultValue={sp.categoria ?? ""} className="rounded-lg border border-ink/15 bg-white px-3 py-2 text-sm">
          <option value="">Todas las categorías</option>{CATEGORIES.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <button className="rounded-full bg-ink px-4 py-2 text-xs font-semibold text-ivory">Filtrar</button>
      </form>
      <div className="overflow-x-auto rounded-2xl border border-ink/[.07] bg-white">
        <table className="w-full min-w-[760px]">
          <thead><tr><th className={thCls}>Conocimiento</th><th className={thCls}>Categoría</th><th className={thCls}>Estado</th><th className={thCls}>Fuente</th><th className={thCls}>Usos</th><th className={thCls}></th></tr></thead>
          <tbody className="divide-y divide-ink/[.06]">
            {rows.length === 0 && <tr><td colSpan={6} className={`${tdCls} text-center text-ink-soft`}>Sin registros. Usa «Cargar conocimiento verificado de la tienda» para empezar.</td></tr>}
            {rows.map((r) => (
              <tr key={r.id} className="align-top">
                <td className={tdCls}>
                  <p className="font-semibold">{r.title} <span className="text-[11px] font-normal text-ink-soft">v{r.version}{r.kind === "documento" ? " · documento" : ""}</span></p>
                  <p className="mt-1 line-clamp-3 max-w-xl text-xs text-ink-soft">{r.body}</p>
                  {r.questions.length > 0 && <p className="mt-1 text-[11px] text-ink-soft">{r.questions.filter((q) => q.status === "aprobada").length}/{r.questions.length} formas de preguntar aprobadas{r.questions.some((q) => q.synthetic) ? " · incluye sintéticas" : ""}</p>}
                  <div className="mt-1 flex flex-wrap gap-1">
                    {r.duplicateOfId && <Badge tone="warning">Posible duplicado</Badge>}
                    {r.conflictWithId && <Badge tone="error">Posible contradicción</Badge>}
                    {r.reviewAt && r.reviewAt < new Date() && <Badge tone="warning">Revisar: desactualizada</Badge>}
                  </div>
                </td>
                <td className={tdCls}>{r.category}</td>
                <td className={tdCls}><Badge tone={statusTone[r.status as keyof typeof statusTone] ?? "neutral"}>{r.status}</Badge></td>
                <td className={`${tdCls} text-xs`}>{r.source}<br /><span className="text-ink-soft">{fmtDate(r.updatedAt)}</span></td>
                <td className={tdCls}>{r.hits}</td>
                <td className={tdCls}><EntryRowActions entry={{ id: r.id, title: r.title, body: r.body, category: r.category, status: r.status, source: r.source, questions: r.questions }} categories={[...CATEGORIES]} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex items-center justify-between text-sm">
        <span className="text-ink-soft">{total} registros</span>
        <span className="flex gap-2">
          {page > 1 && <Link href={qs({ p: String(page - 1) })} className="underline">Anterior</Link>}
          {page * 30 < total && <Link href={qs({ p: String(page + 1) })} className="underline">Siguiente</Link>}
        </span>
      </div>
    </div>
  );
}

async function Quality() {
  const [gaps, byKind, conversations] = await Promise.all([
    prisma.auraKnowledgeGap.findMany({ where: { status: "pendiente" }, orderBy: [{ count: "desc" }, { updatedAt: "desc" }], take: 100 }),
    prisma.auraKnowledgeGap.groupBy({ by: ["kind"], where: { status: "pendiente" }, _count: true }),
    prisma.auraMessage.count({ where: { role: "user" } }).catch(() => 0),
  ]);
  const top = await prisma.knowledgeEntry.findMany({ where: { status: "aprobada", hits: { gt: 0 } }, orderBy: { hits: "desc" }, take: 10, select: { title: true, hits: true } });
  const k = (s: string) => byKind.find((x) => x.kind === s)?._count ?? 0;
  const label = { sin_respuesta: "Sin respuesta", baja_confianza: "Poco confiable", incorrecta: "Marcada como incorrecta" } as const;
  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-4">
        <Stat label="Mensajes de clientes" value={conversations} />
        <Stat label="Preguntas sin respuesta" value={k("sin_respuesta")} tone={k("sin_respuesta") ? "warn" : undefined} />
        <Stat label="Respuestas poco confiables" value={k("baja_confianza")} />
        <Stat label="Marcadas como incorrectas" value={k("incorrecta")} tone={k("incorrecta") ? "warn" : undefined} />
      </div>
      <Card title="Lo que más preguntan (respuestas aprobadas)">
        {top.length ? <ol className="space-y-1 text-sm">{top.map((t) => <li key={t.title} className="flex justify-between"><span>{t.title}</span><span className="text-ink-soft">{t.hits}</span></li>)}</ol> : <p className="text-sm text-ink-soft">Aún no hay respuestas usadas.</p>}
      </Card>
      <Card title="Pendiente de revisar">
        <p className="mb-3 text-xs text-ink-soft">Son preguntas reales de clientes (sin datos personales). Para corregir, crea o edita una respuesta y apruébala; luego marca esta pregunta como resuelta. AURA no aprende sola.</p>
        <div className="divide-y divide-ink/[.06]">
          {gaps.length === 0 && <p className="py-4 text-sm text-ink-soft">Nada pendiente.</p>}
          {gaps.map((g) => (
            <div key={g.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
              <div className="min-w-0">
                <p className="text-sm">«{g.question}»</p>
                <p className="text-[11px] text-ink-soft">{label[g.kind as keyof typeof label] ?? g.kind} · {g.count} vez/veces · {fmtDate(g.updatedAt)}{g.score != null ? ` · puntaje ${g.score.toFixed(2)}` : ""}</p>
              </div>
              <GapActions id={g.id} question={g.question} />
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
