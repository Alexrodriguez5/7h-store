import { createHash } from "node:crypto";
import { Prisma, type PrismaClient } from "@prisma/client";
import { z } from "zod";
import { BUSINESS } from "@/lib/business";
import { formatCOP } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { DEFAULT_ETA, FREE_SHIPPING_THRESHOLD } from "@/lib/shipping";
import { scanPrivate } from "../privacy";
import { buildIndex, matchQuestion, type LibraryDoc, type MatchResult } from "./match";
import { SEED, SEED_VERSION } from "./seed";
import { conceptsOf, normalize, stem, tokens } from "./text";

/**
 * Cerebro de AURA · biblioteca de conocimiento (nivel 1).
 * Regla de oro: el chat SOLO usa entradas "aprobada" y, dentro de ellas, preguntas aprobadas. Todo lo que se
 * importa o genera entra "pendiente" y lo aprueba una persona del equipo. Nada se aprende solo.
 */

export const CATEGORIES = ["tienda", "compras", "productos", "marcas", "tallas", "pagos", "envios", "garantias", "devoluciones", "pedidos", "seguimiento", "solicitudes", "atencion", "recomendaciones", "comparaciones", "objeciones"] as const;
export const STATUSES = ["borrador", "pendiente", "aprobada", "desactivada"] as const;

const hash = (s: string) => createHash("sha256").update(normalize(s)).digest("hex").slice(0, 40);
const searchOf = (title: string, questions: string[]) => normalize([title, ...questions].join(" ")).slice(0, 4000);

/** Valores vigentes de la tienda dentro de las respuestas ({{envio_gratis}}, {{plazo_envio}}, {{aviso_pagos}}). */
export function renderBody(body: string) {
  const sandbox = (process.env.WOMPI_PUBLIC_KEY ?? "").startsWith("pub_test");
  return body
    .replaceAll("{{envio_gratis}}", formatCOP(FREE_SHIPPING_THRESHOLD))
    .replaceAll("{{plazo_envio}}", BUSINESS.shippingTime ?? DEFAULT_ETA)
    .replaceAll("{{aviso_pagos}}", sandbox ? " Importante: por ahora el pago con tarjeta y PSE está en modo de prueba y no realiza cobros reales; para comprar hoy elige transferencia o consignación." : "")
    .trim();
}

// ── Lectura para el chat (con caché corta por instancia) ───────────────
let cache: { at: number; docs: LibraryDoc[]; index: ReturnType<typeof buildIndex> } | null = null;
const CACHE_MS = 60_000;
export const invalidateLibrary = () => { cache = null; };

export async function approvedDocs(db: PrismaClient = prisma): Promise<{ docs: LibraryDoc[]; index: ReturnType<typeof buildIndex> }> {
  if (cache && Date.now() - cache.at < CACHE_MS) return cache;
  const rows = await db.knowledgeEntry.findMany({
    where: { status: "aprobada", kind: "qa", OR: [{ reviewAt: null }, { reviewAt: { gt: new Date() } }] },
    select: { id: true, category: true, title: true, body: true, questions: { where: { status: "aprobada" }, select: { text: true } } },
    take: 5000,
  });
  const docs = rows.map((r) => ({ id: r.id, category: r.category, title: r.title, body: r.body, questions: r.questions.map((q) => q.text) }));
  cache = { at: Date.now(), docs, index: buildIndex(docs) };
  return cache;
}

/**
 * Con bibliotecas grandes, PostgreSQL (búsqueda de texto en español) preselecciona candidatos y el
 * buscador de AURA los ordena. Con pocas entradas se ordenan todas en memoria (más tolerante a errores).
 */
async function candidatesFor(question: string, docs: LibraryDoc[], db: PrismaClient) {
  if (docs.length <= 400) return null;
  const words = tokens(question).map(stem).filter((w) => /^[a-z0-9]{3,}$/.test(w)).slice(0, 8);
  if (!words.length) return null;
  const tsq = words.map((w) => `${w}:*`).join(" | ");
  const rows = await db.$queryRaw<{ id: string }[]>(Prisma.sql`
    SELECT id FROM "KnowledgeEntry"
    WHERE status = 'aprobada' AND kind = 'qa' AND to_tsvector('spanish', "searchText") @@ to_tsquery('spanish', ${tsq})
    LIMIT 60`);
  return rows.length ? new Set(rows.map((r) => r.id)) : null;
}

export interface LibraryAnswer { decision: MatchResult["decision"]; entryId: string | null; title: string | null; text: string | null; score: number; context: string[]; understood: string }

/** Busca la pregunta del cliente (ya filtrada por privacidad) en la biblioteca aprobada. */
export async function answerFromLibrary(question: string, db: PrismaClient = prisma): Promise<LibraryAnswer> {
  const { docs, index } = await approvedDocs(db);
  if (!docs.length) return { decision: "ninguna", entryId: null, title: null, text: null, score: 0, context: [], understood: normalize(question) };
  const subset = await candidatesFor(question, docs, db).catch(() => null);
  const r = matchQuestion(subset ? buildIndex(docs.filter((d) => subset.has(d.id))) : index, question);
  const context = r.candidates.map((c) => `${c.doc.title}: ${renderBody(c.doc.body)}`);
  if (r.decision === "respuesta" && r.best) {
    await db.knowledgeEntry.update({ where: { id: r.best.doc.id }, data: { hits: { increment: 1 } } }).catch(() => undefined);
    return { decision: "respuesta", entryId: r.best.doc.id, title: r.best.doc.title, text: renderBody(r.best.doc.body), score: r.best.score, context, understood: r.understood };
  }
  return { decision: r.decision, entryId: r.best?.doc.id ?? null, title: r.best?.doc.title ?? null, text: null, score: r.best?.score ?? 0, context, understood: r.understood };
}

/** ¿Parece una pregunta de tienda? (para registrar vacíos útiles, no cada "hola" o "sí"). */
export function looksLikeStoreQuestion(q: string) {
  const w = tokens(q).map(stem);
  return w.length >= 2 && conceptsOf(w, normalize(q)).size > 0;
}

/** Registra una pregunta sin respuesta, poco confiable o marcada como incorrecta. Agrupa las repetidas. */
export async function recordGap(question: string, kind: "sin_respuesta" | "baja_confianza" | "incorrecta", opts: { entryId?: string | null; score?: number } = {}, db: PrismaClient = prisma) {
  const text = scanPrivate(question).text.slice(0, 500);
  const normalized = normalize(text).slice(0, 300);
  if (!normalized) return;
  const existing = await db.auraKnowledgeGap.findFirst({ where: { normalized, kind, status: "pendiente" }, select: { id: true } });
  if (existing) await db.auraKnowledgeGap.update({ where: { id: existing.id }, data: { count: { increment: 1 } } });
  else await db.auraKnowledgeGap.create({ data: { question: text, normalized, kind, entryId: opts.entryId ?? null, score: opts.score ?? null } });
}

// ── Escritura (panel) ───────────────────────────────────────────────────
export const entryInput = z.object({
  title: z.string().trim().min(3).max(200),
  body: z.string().trim().min(10).max(4000),
  category: z.enum(CATEGORIES),
  source: z.string().trim().min(2).max(200),
  sourceUrl: z.string().trim().max(300).nullish().transform((v) => v || null),
  questions: z.array(z.string().trim().min(3).max(300)).max(60).default([]),
  /** Variantes sintéticas (escritas por una herramienta): quedan pendientes. */
  synthetic: z.array(z.string().trim().min(3).max(300)).max(60).default([]),
  reviewAt: z.string().nullish().refine((v) => !v || !Number.isNaN(Date.parse(v)), "Fecha no válida"),
});
export type EntryInput = z.infer<typeof entryInput>;

export class KnowledgeError extends Error { constructor(public status: number, message: string) { super(message); } }

/** Revisa el texto: nada de datos personales ni claves dentro del conocimiento. */
function guard(text: string) {
  const p = scanPrivate(text);
  if (p.block) throw new KnowledgeError(400, "El texto contiene datos que no deben estar en la biblioteca (tarjetas, claves, documentos o similares).");
}

/** Detecta duplicados (misma respuesta o pregunta casi igual) y contradicciones (pregunta igual, respuesta distinta). */
/** Índice de comparación reutilizable en una importación grande (se reconstruye cada 200 filas, no en cada una). */
export interface ConflictPool { docs: LibraryDoc[]; index: ReturnType<typeof buildIndex> | null; pending: number }

async function loadPool(db: PrismaClient, excludeId: string | null): Promise<ConflictPool> {
  const others = await db.knowledgeEntry.findMany({ where: { kind: "qa", status: { not: "desactivada" }, ...(excludeId ? { id: { not: excludeId } } : {}) }, select: { id: true, title: true, body: true, category: true, questions: { select: { text: true } } }, take: 5000 });
  const docs = others.map((o) => ({ id: o.id, category: o.category, title: o.title, body: o.body, questions: o.questions.map((q) => q.text) }));
  return { docs, index: docs.length ? buildIndex(docs) : null, pending: 0 };
}

export async function findConflicts(input: { title: string; body: string; questions: string[] }, excludeId: string | null, db: PrismaClient = prisma, pool?: ConflictPool) {
  const contentHash = hash(`${input.title}\n${input.body}`);
  const same = await db.knowledgeEntry.findFirst({ where: { contentHash, status: { not: "desactivada" }, ...(excludeId ? { id: { not: excludeId } } : {}) }, select: { id: true } });
  if (same) return { contentHash, duplicateOfId: same.id, conflictWithId: null as string | null };
  const p = pool ?? (await loadPool(db, excludeId));
  if (p.pending >= 200 || (!p.index && p.docs.length)) { p.index = buildIndex(p.docs); p.pending = 0; }
  const idx = p.index;
  if (!idx) return { contentHash, duplicateOfId: null, conflictWithId: null };
  let duplicateOfId: string | null = null, conflictWithId: string | null = null;
  for (const q of [input.title, ...input.questions].slice(0, 10)) {
    const m = matchQuestion(idx, q);
    if (!m.best || m.best.score < 0.75) continue;
    // Pregunta casi igual: si la respuesta también se parece es duplicado; si no, posible contradicción.
    const sameAnswer = matchQuestion(buildIndex([{ ...m.best.doc, questions: [m.best.doc.body] }]), input.body).best?.score ?? 0;
    if (sameAnswer >= 0.6) duplicateOfId ??= m.best.doc.id;
    else conflictWithId ??= m.best.doc.id;
  }
  return { contentHash, duplicateOfId, conflictWithId };
}

export async function createEntry(input: EntryInput, meta: { adminId: string | null; batch?: string; kind?: "qa" | "documento"; synthetic?: boolean; pool?: ConflictPool }, db: PrismaClient = prisma) {
  [input.title, input.body, ...input.questions, ...input.synthetic].forEach(guard);
  // Los fragmentos de documentos no se comparan como preguntas (solo por huella exacta).
  const c = meta.kind === "documento"
    ? { contentHash: hash(`${input.title}
${input.body}`), duplicateOfId: (await db.knowledgeEntry.findFirst({ where: { contentHash: hash(`${input.title}
${input.body}`) }, select: { id: true } }))?.id ?? null, conflictWithId: null }
    : await findConflicts(input, null, db, meta.pool);
  const e = await db.knowledgeEntry.create({
    data: {
      kind: meta.kind ?? "qa", title: input.title, body: input.body, category: input.category, status: "pendiente", source: input.source, sourceUrl: input.sourceUrl,
      synthetic: meta.synthetic ?? false, contentHash: c.contentHash, searchText: searchOf(input.title, [...input.questions, ...input.synthetic]),
      reviewAt: input.reviewAt ? new Date(input.reviewAt) : null, duplicateOfId: c.duplicateOfId, conflictWithId: c.conflictWithId, batch: meta.batch ?? null,
      questions: { create: [...input.questions.map((t) => ({ text: t, searchText: normalize(t), synthetic: false })), ...input.synthetic.map((t) => ({ text: t, searchText: normalize(t), synthetic: true }))] },
      revisions: { create: { version: 1, action: "creada", snapshot: input as unknown as Prisma.InputJsonValue, adminId: meta.adminId } },
    },
    select: { id: true, duplicateOfId: true, conflictWithId: true },
  });
  if (meta.pool && (meta.kind ?? "qa") === "qa") { meta.pool.docs.push({ id: e.id, category: input.category, title: input.title, body: input.body, questions: [...input.questions, ...input.synthetic] }); meta.pool.pending++; }
  return e;
}

export async function updateEntry(id: string, input: EntryInput, adminId: string, db: PrismaClient = prisma) {
  [input.title, input.body, ...input.questions].forEach(guard);
  const prev = await db.knowledgeEntry.findUnique({ where: { id }, select: { version: true, status: true } });
  if (!prev) throw new KnowledgeError(404, "No existe.");
  const c = await findConflicts(input, id, db);
  await db.$transaction([
    db.knowledgeQuestion.deleteMany({ where: { entryId: id, synthetic: false } }),
    db.knowledgeEntry.update({
      where: { id },
      data: {
        title: input.title, body: input.body, category: input.category, source: input.source, sourceUrl: input.sourceUrl, version: prev.version + 1,
        // Un cambio en una respuesta aprobada vuelve a revisión: nada cambia en el chat sin aprobación.
        status: "pendiente", approvedAt: null, approvedById: null, contentHash: c.contentHash, duplicateOfId: c.duplicateOfId, conflictWithId: c.conflictWithId,
        reviewAt: input.reviewAt ? new Date(input.reviewAt) : null, searchText: searchOf(input.title, input.questions),
        questions: { create: input.questions.map((t) => ({ text: t, searchText: normalize(t), synthetic: false, status: "pendiente" })) },
        revisions: { create: { version: prev.version + 1, action: "editada", snapshot: input as unknown as Prisma.InputJsonValue, adminId } },
      },
    }),
  ]);
  invalidateLibrary();
}

/** Aprueba (o desactiva) una entrada. Al aprobar, también sus preguntas no sintéticas; las sintéticas solo si se indica. */
export async function setEntryStatus(id: string, status: "aprobada" | "desactivada" | "pendiente", adminId: string, opts: { includeSynthetic?: boolean } = {}, db: PrismaClient = prisma) {
  const e = await db.knowledgeEntry.findUnique({ where: { id }, select: { version: true, conflictWithId: true, duplicateOfId: true } });
  if (!e) throw new KnowledgeError(404, "No existe.");
  await db.$transaction([
    db.knowledgeEntry.update({ where: { id }, data: { status, ...(status === "aprobada" ? { approvedById: adminId, approvedAt: new Date() } : {}), revisions: { create: { version: e.version, action: status, snapshot: { status }, adminId } } } }),
    ...(status === "aprobada" ? [db.knowledgeQuestion.updateMany({ where: { entryId: id, ...(opts.includeSynthetic ? {} : { synthetic: false }) }, data: { status: "aprobada" } })] : []),
  ]);
  invalidateLibrary();
}

export async function setQuestionStatus(questionId: string, status: "aprobada" | "desactivada", db: PrismaClient = prisma) {
  await db.knowledgeQuestion.update({ where: { id: questionId }, data: { status } });
  invalidateLibrary();
}

/** Carga el conocimiento inicial (páginas publicadas de la tienda). Idempotente: no repite lo ya cargado. */
export async function importSeed(adminId: string, db: PrismaClient = prisma) {
  let created = 0, skipped = 0;
  for (const s of SEED) {
    const exists = await db.knowledgeEntry.findFirst({ where: { contentHash: hash(`${s.title}\n${s.body}`) }, select: { id: true } });
    if (exists) { skipped++; continue; }
    await createEntry({ title: s.title, body: s.body, category: s.category as EntryInput["category"], source: s.source, sourceUrl: s.sourceUrl, questions: s.questions, synthetic: s.variants, reviewAt: null }, { adminId, batch: `semilla-${SEED_VERSION}` }, db);
    created++;
  }
  return { created, skipped };
}

// ── Importación de archivos (TXT, Markdown, CSV, JSON) ─────────────────
export const MAX_IMPORT_ROWS = 5000;

const rowSchema = z.object({
  pregunta: z.string().trim().min(3).max(300),
  respuesta: z.string().trim().min(10).max(4000),
  categoria: z.enum(CATEGORIES).catch("tienda"),
  variantes: z.array(z.string().trim().min(3).max(300)).max(60).default([]),
  fuente: z.string().trim().min(2).max(200).catch("Importación"),
  sinteticas: z.boolean().default(false),
});

function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [], cell = "", quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') { cell += '"'; i++; } else if (ch === '"') quoted = false; else cell += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === "," || ch === ";") { row.push(cell); cell = ""; }
    else if (ch === "\n" || ch === "\r") { if (ch === "\r" && text[i + 1] === "\n") i++; row.push(cell); rows.push(row); row = []; cell = ""; }
    else cell += ch;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  return rows.filter((r) => r.some((c) => c.trim()));
}

/** Divide un documento en fragmentos de ~120 palabras respetando títulos y párrafos. */
export function chunkDocument(text: string, fallbackTitle: string) {
  const out: { title: string; body: string }[] = [];
  let title = fallbackTitle, buf: string[] = [];
  const flush = () => { const b = buf.join("\n").trim(); if (b.length >= 40) out.push({ title, body: b.slice(0, 4000) }); buf = []; };
  for (const line of text.replace(/\r/g, "").split("\n")) {
    const h = line.match(/^#{1,4}\s+(.+)/);
    if (h) { flush(); title = h[1].trim().slice(0, 200); continue; }
    buf.push(line);
    if (buf.join(" ").split(/\s+/).length > 120 && !line.trim()) flush();
  }
  flush();
  return out;
}

export interface ImportResult { created: number; duplicates: number; conflicts: number; skipped: number; errors: string[]; batch: string }

export async function importFile(name: string, text: string, opts: { category: EntryInput["category"]; source: string; adminId: string }, db: PrismaClient = prisma): Promise<ImportResult> {
  const ext = name.toLowerCase().split(".").pop() ?? "";
  const batch = `import-${new Date().toISOString().slice(0, 16)}-${name.slice(0, 40)}`;
  const res: ImportResult = { created: 0, duplicates: 0, conflicts: 0, skipped: 0, errors: [], batch };
  const pool = await loadPool(db, null);
  const add = async (input: EntryInput, kind: "qa" | "documento", synthetic = false) => {
    try {
      const e = await createEntry(input, { adminId: opts.adminId, batch, kind, synthetic, pool }, db);
      res.created++;
      if (e.duplicateOfId) res.duplicates++;
      if (e.conflictWithId) res.conflicts++;
    } catch (err) {
      res.skipped++;
      if (res.errors.length < 20) res.errors.push(err instanceof Error ? err.message : "Error");
    }
  };

  if (ext === "json" || ext === "csv") {
    let rows: unknown[] = [];
    if (ext === "json") {
      const parsed = JSON.parse(text) as unknown;
      rows = Array.isArray(parsed) ? parsed : Array.isArray((parsed as { items?: unknown[] }).items) ? (parsed as { items: unknown[] }).items : [];
    } else {
      const [header, ...data] = parseCsv(text);
      const keys = header.map((h) => normalize(h));
      rows = data.map((r) => Object.fromEntries(keys.map((k, i) => [k, k === "variantes" ? (r[i] ?? "").split("|").map((s) => s.trim()).filter(Boolean) : k === "sinteticas" ? /^(si|true|1)$/i.test(r[i] ?? "") : (r[i] ?? "").trim()])));
    }
    if (rows.length > MAX_IMPORT_ROWS) throw new KnowledgeError(400, `Máximo ${MAX_IMPORT_ROWS} registros por archivo.`);
    for (const raw of rows) {
      const r = rowSchema.safeParse({ ...(raw as object), categoria: (raw as { categoria?: string }).categoria ?? opts.category, fuente: (raw as { fuente?: string }).fuente ?? opts.source });
      if (!r.success) { res.skipped++; if (res.errors.length < 20) res.errors.push(`Fila inválida: ${r.error.issues[0]?.message}`); continue; }
      await add({ title: r.data.pregunta, body: r.data.respuesta, category: r.data.categoria, source: r.data.fuente, sourceUrl: null, questions: r.data.sinteticas ? [] : [r.data.pregunta], synthetic: r.data.sinteticas ? [r.data.pregunta, ...r.data.variantes] : r.data.variantes, reviewAt: null }, "qa", r.data.sinteticas);
    }
    return res;
  }
  if (ext === "txt" || ext === "md" || ext === "markdown") {
    const chunks = chunkDocument(text, name.replace(/\.[^.]+$/, ""));
    if (chunks.length > MAX_IMPORT_ROWS) throw new KnowledgeError(400, "El documento es demasiado grande. Divídelo en partes.");
    for (const c of chunks) await add({ title: c.title, body: c.body, category: opts.category, source: opts.source, sourceUrl: null, questions: [], synthetic: [], reviewAt: null }, "documento");
    return res;
  }
  throw new KnowledgeError(400, "Formato no compatible todavía. Usa TXT, Markdown, CSV o JSON. PDF y DOCX se procesarán con el servicio de IA local (fase 4).");
}
