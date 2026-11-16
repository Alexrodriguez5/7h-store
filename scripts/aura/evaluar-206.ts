/**
 * Evaluación de AURA con las 206 preguntas de tests/fixtures/aura-eval.txt (SOLO desarrollo, solo lectura).
 *
 *   npx tsx scripts/aura/evaluar-206.ts <carpeta-salida>
 *
 * Recorre el mismo camino que la tienda:
 *   1. Biblioteca aprobada (índice de la semilla, sin IA, sin escribir en la base).
 *   2. Si la biblioteca no responde: Qwen (Ollama) con herramientas de solo lectura y el control de
 *      información comercial (grounding.ts). Si Qwen da un dato sin fuente, se marca "transferida a Gemini"
 *      (Gemini no se llama aquí para no gastar la cuota gratuita).
 * Además, para las preguntas de políticas prioritarias (envíos, devoluciones, garantías, pagos, precios) se
 * hace una PRUEBA DE ESTRÉS: Qwen responde sin la biblioteca, para medir si inventa cuando no hay respuesta aprobada.
 *
 * Escribe resultados.json, resultados.csv y resumen.json en la carpeta indicada (fuera del repositorio).
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { loadEnvConfig } from "@next/env";

loadEnvConfig(process.cwd());

const POLICY = new Set(["costo-envio", "tiempo-envio", "cobertura-envio", "retracto", "garantia", "metodos-pago", "tiempo-pago", "impuestos", "pqr"]);

async function main() {
  const out = resolve(process.argv[2] ?? "");
  if (!process.argv[2] || out.startsWith(resolve(process.cwd()))) throw new Error("Indica una carpeta de salida fuera del repositorio.");
  mkdirSync(out, { recursive: true });

  process.env.AURA_PROVIDER = "ollama";
  process.env.OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL || "http://127.0.0.1:11434";
  process.env.OLLAMA_MODEL = process.env.OLLAMA_MODEL || "qwen3.5:4b";

  const { SEED } = await import("@/lib/aura/library/seed");
  const { buildIndex, matchQuestion } = await import("@/lib/aura/library/match");
  const { renderBody } = await import("@/lib/aura/library/service");
  const { auraConfig } = await import("@/lib/aura/config");
  const { ollamaProvider } = await import("@/lib/aura/ollama");
  const { groundedProvider } = await import("@/lib/aura/grounding");
  const { createToolRunner, TOOL_SPECS } = await import("@/lib/aura/tools");
  const { systemPrompt } = await import("@/lib/aura/prompt");
  const { AiError } = await import("@/lib/aura/provider");
  const { prisma } = await import("@/lib/prisma");

  const cfg = auraConfig();
  const index = buildIndex(SEED.map((s) => ({ id: s.slug, category: s.category, title: s.title, body: s.body, questions: [...s.questions, ...s.variants] })));
  const cases = readFileSync("tests/fixtures/aura-eval.txt", "utf8").split("\n").filter((l) => l.trim() && !l.startsWith("#")).map((l) => {
    const [e, ...q] = l.split("|");
    return { expect: e.trim() === "-" ? null : e.trim(), q: q.join("|").trim() };
  });

  // Carga el modelo antes de medir.
  await fetch(`${cfg.ollama.baseUrl}/api/generate`, { method: "POST", body: JSON.stringify({ model: cfg.ollama.model, prompt: "", keep_alive: "15m" }) });

  async function askQwen(text: string) {
    let rejected: string[] = [];
    const qwen = groundedProvider(ollamaProvider({ baseUrl: cfg.ollama.baseUrl!, model: cfg.ollama.model, timeoutMs: 30_000, numCtx: cfg.ollama.numCtx }), (c) => { rejected = c; });
    const tools = createToolRunner(cfg);
    const t0 = performance.now();
    try {
      const r = await qwen.run({ system: systemPrompt({ signedIn: false, catalogIsDemo: cfg.catalogIsDemo }), history: [{ role: "user", text }], tools: TOOL_SPECS, execute: tools.execute, maxCalls: 3, signal: AbortSignal.timeout(35_000) });
      return { route: "qwen", ms: Math.round(performance.now() - t0), tools: r.toolsUsed, text: r.text, rejected };
    } catch (e) {
      const ms = Math.round(performance.now() - t0);
      if (rejected.length) return { route: "transferida_gemini", ms, tools: [], text: "", rejected };
      return { route: "error", ms, tools: [], text: e instanceof AiError ? `${e.kind}: ${e.message}` : "error", rejected };
    }
  }

  const rows = [];
  let i = 0;
  for (const c of cases) {
    i++;
    const m = matchQuestion(index, c.q);
    const lib = m.decision === "respuesta" ? m.best!.doc.id : null;
    let row: Record<string, unknown> = { n: i, esperado: c.expect ?? "-", pregunta: c.q };
    if (lib) {
      row = { ...row, ruta: "biblioteca", obtenido: lib, veredicto: lib === c.expect ? "correcta" : c.expect === null ? "respondio_de_mas" : "equivocada", ms: 0 };
    } else {
      const context = m.candidates.map((x) => `${x.doc.title}: ${renderBody(x.doc.body)}`);
      const text = context.length ? `${c.q}\n[Información aprobada de 7H STORE que puede servir (úsala solo si responde la pregunta): ${context.join(" | ").slice(0, 1500)}]` : c.q;
      const r = await askQwen(text);
      row = { ...row, ruta: r.route, ms: r.ms, herramientas: r.tools.join(" "), descartado_por: r.rejected.join(" / "), respuesta: r.text, veredicto: r.route === "error" ? "error" : r.route === "transferida_gemini" ? "transferida" : "revisar" };
    }
    // Prueba de estrés: Qwen sin biblioteca en las políticas prioritarias.
    if (c.expect && POLICY.has(c.expect)) {
      const s = await askQwen(c.q);
      row = { ...row, estres_ruta: s.route, estres_ms: s.ms, estres_herramientas: s.tools.join(" "), estres_descartado_por: s.rejected.join(" / "), estres_respuesta: s.text };
    }
    rows.push(row);
    process.stdout.write(`\r${i}/${cases.length}`);
  }

  const by = (k: string, v: string) => rows.filter((r) => r[k] === v).length;
  const qwenMs = rows.filter((r) => r.ruta === "qwen").map((r) => r.ms as number).sort((a, b) => a - b);
  const stress = rows.filter((r) => r.estres_ruta);
  const summary = {
    fecha: new Date().toISOString(), modelo: cfg.ollama.model, total: rows.length,
    biblioteca: { respondidas: by("ruta", "biblioteca"), correctas: by("veredicto", "correcta"), equivocadas: by("veredicto", "equivocada"), de_mas: by("veredicto", "respondio_de_mas") },
    qwen: { respondidas: by("ruta", "qwen"), transferidas_a_gemini: by("ruta", "transferida_gemini"), errores: by("ruta", "error"), mediana_ms: qwenMs[Math.floor(qwenMs.length / 2)] ?? null, p90_ms: qwenMs[Math.floor(qwenMs.length * 0.9)] ?? null },
    estres_politicas_sin_biblioteca: { total: stress.length, respondidas_con_fuente: stress.filter((r) => r.estres_ruta === "qwen").length, descartadas_por_dato_sin_fuente: stress.filter((r) => r.estres_ruta === "transferida_gemini").length, errores: stress.filter((r) => r.estres_ruta === "error").length, uso_consultar_politicas: stress.filter((r) => String(r.estres_herramientas).includes("consultar_politicas")).length },
  };
  writeFileSync(join(out, "resultados.json"), JSON.stringify(rows, null, 2));
  const cols = ["n", "esperado", "pregunta", "ruta", "veredicto", "obtenido", "ms", "herramientas", "descartado_por", "respuesta", "estres_ruta", "estres_herramientas", "estres_descartado_por", "estres_respuesta"];
  const csv = [cols.join(";"), ...rows.map((r) => cols.map((k) => `"${String(r[k] ?? "").replace(/"/g, '""').replace(/\s+/g, " ")}"`).join(";"))].join("\n");
  writeFileSync(join(out, "resultados.csv"), "﻿" + csv);
  writeFileSync(join(out, "resumen.json"), JSON.stringify(summary, null, 2));
  console.log("\n" + JSON.stringify(summary, null, 2));
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message.slice(0, 300) : e);
  process.exit(1);
});
