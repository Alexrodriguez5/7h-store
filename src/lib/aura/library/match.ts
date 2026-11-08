import { CONCEPT_VOCAB, conceptsOf, correct, normalize, stem, tokens } from "./text";

/**
 * Buscador de la biblioteca (nivel 1). Compara la pregunta del cliente con TODAS las formas aprobadas de
 * cada respuesta y devuelve la mejor con su puntaje. Si no hay una coincidencia clara, no responde: el
 * mensaje pasa al nivel 2 (modelo). Nunca arma una respuesta nueva: solo devuelve textos aprobados.
 */

export interface LibraryDoc { id: string; category: string; title: string; body: string; questions: string[] }

interface IndexedQ { words: string[]; wordSet: Set<string>; concepts: Set<string>; grams: Set<string> }
interface IndexedDoc { doc: LibraryDoc; qs: IndexedQ[]; vocab: Set<string> }
export interface LibraryIndex { docs: IndexedDoc[]; vocab: Set<string>; idf: Map<string, number> }

export interface Match { doc: LibraryDoc; score: number; coverage: number }
export interface MatchResult {
  /** "respuesta" = se responde con el texto aprobado; "contexto" = se pasa al modelo como pista; "ninguna" = sin coincidencia. */
  decision: "respuesta" | "contexto" | "ninguna";
  best: Match | null;
  candidates: Match[];
  /** Pregunta tal como se interpretó (normalizada y corregida), útil para revisar en el panel. */
  understood: string;
}

/** Umbrales. Se calibraron con el conjunto de evaluación (tests/fixtures/aura-eval.json). */
export const THRESHOLDS = { answer: 0.5, margin: 0.08, context: 0.3, coverage: 0.7 };

const grams = (s: string) => {
  const t = ` ${s} `;
  const out = new Set<string>();
  for (let i = 0; i < t.length - 2; i++) out.add(t.slice(i, i + 3));
  return out;
};
const dice = (a: Set<string>, b: Set<string>) => {
  if (!a.size || !b.size) return 0;
  let n = 0;
  for (const x of a) if (b.has(x)) n++;
  return (2 * n) / (a.size + b.size);
};

function indexQuestion(text: string): IndexedQ {
  const n = normalize(text);
  const words = tokens(n).map(stem);
  return { words, wordSet: new Set(words), concepts: conceptsOf(words, n), grams: grams(words.join(" ")) };
}

export function buildIndex(docs: LibraryDoc[]): LibraryIndex {
  const indexed = docs.map((doc) => {
    const qs = [doc.title, ...doc.questions].filter(Boolean).map(indexQuestion);
    const vocab = new Set(qs.flatMap((q) => q.words));
    return { doc, qs, vocab };
  });
  const df = new Map<string, number>();
  for (const d of indexed) for (const w of d.vocab) df.set(w, (df.get(w) ?? 0) + 1);
  const N = Math.max(1, indexed.length);
  const idf = new Map([...df].map(([w, c]) => [w, Math.log(1 + N / c)]));
  const vocab = new Set([...df.keys(), ...CONCEPT_VOCAB]);
  return { docs: indexed, vocab, idf };
}

function scoreQ(q: IndexedQ, v: IndexedQ, idf: Map<string, number>) {
  const w = (x: string) => idf.get(x) ?? 1.5;
  let common = 0, qa = 0, va = 0;
  for (const x of q.wordSet) { qa += w(x); if (v.wordSet.has(x)) common += w(x); }
  for (const x of v.wordSet) va += w(x);
  const wordSim = qa && va ? common / Math.sqrt(qa * va) : 0;
  let inter = 0;
  for (const c of q.concepts) if (v.concepts.has(c)) inter++;
  const union = new Set([...q.concepts, ...v.concepts]).size;
  const conceptSim = union ? inter / union : 0;
  return 0.45 * wordSim + 0.35 * conceptSim + 0.2 * dice(q.grams, v.grams);
}

export function matchQuestion(index: LibraryIndex, question: string): MatchResult {
  const n = normalize(question);
  // Raíz primero y corrección después: así "enbios" → "enbio" → "envio".
  const fixed = tokens(n).map((w) => correct(stem(w), index.vocab));
  const q = indexQuestion(fixed.join(" "));
  const understood = fixed.join(" ");
  if (!q.words.length) return { decision: "ninguna", best: null, candidates: [], understood };

  const scored: Match[] = index.docs.map((d) => {
    let best = 0;
    for (const v of d.qs) best = Math.max(best, scoreQ(q, v, index.idf));
    // Cobertura: qué parte de lo que dijo el cliente "conoce" esta respuesta (por palabra o por concepto).
    // Una marca o un producto que la respuesta no menciona baja la cobertura: esa pregunta es para el catálogo.
    const docConcepts = new Set(d.qs.flatMap((x) => [...x.concepts]));
    const known = q.words.filter((w) => d.vocab.has(w) || [...conceptsOf([w], w)].some((c) => docConcepts.has(c))).length;
    const coverage = known / q.words.length;
    // Una sola palabra útil ("tienda", "pedido") es ambigua: se exige más para responder sin el modelo.
    const single = q.words.length === 1 && index.docs.filter((x) => x.vocab.has(q.words[0])).length > 1 ? 0.45 : 1;
    return { doc: d.doc, score: (coverage < THRESHOLDS.coverage ? best * 0.6 : best) * single, coverage };
  });
  scored.sort((a, b) => b.score - a.score);
  const best = scored[0] ?? null;
  // Margen contra la SEGUNDA mejor respuesta: si dos respuestas compiten, no se elige ninguna.
  const second = scored[1];
  const margin = best ? best.score - (second?.score ?? 0) : 0;
  const candidates = scored.filter((m) => m.score >= THRESHOLDS.context).slice(0, 3);

  if (best && best.score >= THRESHOLDS.answer && margin >= THRESHOLDS.margin) return { decision: "respuesta", best, candidates, understood };
  if (best && best.score >= THRESHOLDS.context) return { decision: "contexto", best, candidates, understood };
  return { decision: "ninguna", best, candidates: [], understood };
}
