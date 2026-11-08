import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { buildIndex, matchQuestion, type LibraryDoc } from "@/lib/aura/library/match";
import { SEED } from "@/lib/aura/library/seed";
import { correct, normalize } from "@/lib/aura/library/text";

/** Evaluación del nivel 1 con la biblioteca inicial (como si el administrador ya la hubiera aprobado). */
const docs: LibraryDoc[] = SEED.map((s) => ({ id: s.slug, category: s.category, title: s.title, body: s.body, questions: [...s.questions, ...s.variants] }));
const index = buildIndex(docs);
const cases = readFileSync(path.join(__dirname, "fixtures/aura-eval.txt"), "utf8").split("\n").filter((l) => l.trim() && !l.startsWith("#")).map((l) => {
  const [expect, ...q] = l.split("|");
  return { expect: expect.trim() === "-" ? null : expect.trim(), q: q.join("|").trim() };
});

export function evaluate() {
  const rows = cases.map((c) => {
    const r = matchQuestion(index, c.q);
    const got = r.decision === "respuesta" ? r.best!.doc.id : null;
    const verdict = got === c.expect ? "ok" : got === null ? "no_respondio" : c.expect === null ? "respondio_de_mas" : "respuesta_equivocada";
    return { ...c, got, score: r.best ? +r.best.score.toFixed(3) : 0, decision: r.decision, verdict, top: r.best?.doc.id ?? null };
  });
  const count = (v: string) => rows.filter((r) => r.verdict === v).length;
  return { rows, total: rows.length, ok: count("ok"), missed: count("no_respondio"), wrong: count("respuesta_equivocada"), extra: count("respondio_de_mas") };
}

describe("biblioteca de AURA · nivel 1", () => {
  it("normaliza y corrige errores ortográficos", () => {
    expect(normalize("¿Cuánto VALE el envío?")).toBe("cuanto vale el envio");
    const vocab = new Set(["envio", "devolucion", "garantia"]);
    expect(correct("enbio", vocab)).toBe("envio");
    expect(correct("debolucion", vocab)).toBe("devolucion");
    expect(correct("garantia", vocab)).toBe("garantia");
  });

  it("evaluación de 206 preguntas: nunca responde mal y responde la gran mayoría", () => {
    const r = evaluate();
    const fails = r.rows.filter((x) => x.verdict !== "ok").map((x) => `${x.verdict}: "${x.q}" esperaba ${x.expect ?? "-"} obtuvo ${x.got ?? "-"} (mejor ${x.top} ${x.score})`);
    console.log(`\nNivel 1 · ${r.ok}/${r.total} correctas · ${r.missed} sin responder (pasan al modelo) · ${r.wrong} respuestas equivocadas · ${r.extra} respondidas de más\n${fails.join("\n")}`);
    // Lo grave es responder algo equivocado o responder cuando no debía: eso debe ser cero.
    expect(r.wrong).toBe(0);
    expect(r.extra).toBe(0);
    // Lo que no responde no es un error: pasa al modelo. Aun así, la biblioteca debe cubrir la mayoría.
    expect(r.ok / r.total).toBeGreaterThanOrEqual(0.75); // medido el 8-nov-2026: 161/206 (78 %)
  });
});

import { chunkDocument, renderBody } from "@/lib/aura/library/service";

describe("biblioteca · documentos y valores vigentes", () => {
  it("divide un documento por títulos y párrafos", () => {
    const md = "# Envíos\nEnviamos a todo el país con guía de seguimiento y transportadora certificada.\n\n# Pagos\nAceptamos tarjeta, PSE, transferencia y consignación en todas las compras.";
    expect(chunkDocument(md, "doc").map((c) => c.title)).toEqual(["Envíos", "Pagos"]);
  });
  it("llena los marcadores con los valores actuales de la tienda", () => {
    const t = renderBody("Gratis desde {{envio_gratis}}. Plazo: {{plazo_envio}}.{{aviso_pagos}}");
    expect(t).toMatch(/Gratis desde \$\s?500\.000/);
    expect(t).not.toContain("{{");
  });
  it("ninguna respuesta de la semilla tiene marcadores desconocidos ni datos personales", async () => {
    const { scanPrivate } = await import("@/lib/aura/privacy");
    for (const s of SEED) {
      expect(renderBody(s.body)).not.toMatch(/\{\{/);
      expect(scanPrivate(s.body).kinds).toEqual([]);
    }
  });
});
