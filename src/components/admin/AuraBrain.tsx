"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { adminFetch } from "./api";
import { btnDanger, btnGhost, btnPrimary, inputCls, labelCls } from "./ui";

type Q = { id: string; text: string; synthetic: boolean; status: string };
type Entry = { id: string; title: string; body: string; category: string; status: string; source: string; questions: Q[] };

const lines = (s: string) => s.split("\n").map((x) => x.trim()).filter(Boolean);

/** Formulario de una entrada: respuesta aprobable + formas de preguntar. Al guardar queda "pendiente". */
function EntryForm({ initial, categories, onDone }: { initial?: Entry; categories: string[]; onDone: () => void }) {
  const [v, setV] = useState({
    title: initial?.title ?? "", body: initial?.body ?? "", category: initial?.category ?? "tienda", source: initial?.source ?? "Equipo 7H STORE",
    questions: (initial?.questions.filter((q) => !q.synthetic).map((q) => q.text) ?? []).join("\n"),
  });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string>();
  const save = async () => {
    setBusy(true); setErr(undefined);
    const data = { title: v.title, body: v.body, category: v.category, source: v.source, sourceUrl: null, questions: lines(v.questions), synthetic: [], reviewAt: null };
    const r = initial ? await adminFetch(`/api/admin/aura/conocimiento/${initial.id}`, "POST", { action: "edit", data }) : await adminFetch("/api/admin/aura/conocimiento", "POST", data);
    setBusy(false);
    if (!r.ok) return setErr(r.error);
    onDone();
  };
  return (
    <div className="space-y-3 rounded-2xl border border-ink/10 bg-ivory/40 p-4">
      <div><label className={labelCls}>Pregunta principal (título)</label><input className={inputCls} value={v.title} onChange={(e) => setV({ ...v, title: e.target.value })} maxLength={200} /></div>
      <div><label className={labelCls}>Respuesta aprobada</label><textarea className={inputCls} rows={4} value={v.body} onChange={(e) => setV({ ...v, body: e.target.value })} maxLength={4000} />
        <p className="mt-1 text-[11px] text-ink-soft">Puedes usar {"{{envio_gratis}}"}, {"{{plazo_envio}}"} y {"{{aviso_pagos}}"}: se llenan con los valores vigentes de la tienda.</p></div>
      <div><label className={labelCls}>Otras formas de preguntar (una por línea)</label><textarea className={inputCls} rows={4} value={v.questions} onChange={(e) => setV({ ...v, questions: e.target.value })} /></div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div><label className={labelCls}>Categoría</label><select className={inputCls} value={v.category} onChange={(e) => setV({ ...v, category: e.target.value })}>{categories.map((c) => <option key={c}>{c}</option>)}</select></div>
        <div><label className={labelCls}>Fuente (de dónde sale este dato)</label><input className={inputCls} value={v.source} onChange={(e) => setV({ ...v, source: e.target.value })} maxLength={200} /></div>
      </div>
      {err && <p role="alert" className="text-sm text-error">{err}</p>}
      <div className="flex gap-2">
        <button type="button" disabled={busy} onClick={save} className={btnPrimary}>{busy ? "Guardando…" : "Guardar (queda pendiente de aprobación)"}</button>
        <button type="button" onClick={onDone} className={btnGhost}>Cancelar</button>
      </div>
    </div>
  );
}

export function BrainActions({ categories }: { categories: string[] }) {
  const router = useRouter();
  const [open, setOpen] = useState<"nueva" | "importar" | null>(null);
  const [msg, setMsg] = useState<string>();
  const [busy, setBusy] = useState(false);
  const seed = async () => {
    setBusy(true);
    const r = await adminFetch<{ created: number; skipped: number }>("/api/admin/aura/conocimiento", "POST", { semilla: true });
    setBusy(false);
    setMsg(r.ok ? `Listo: ${r.data.created} entradas nuevas (pendientes de tu aprobación), ${r.data.skipped} ya existían.` : r.error);
    router.refresh();
  };
  const upload = async (form: HTMLFormElement) => {
    setBusy(true); setMsg(undefined);
    const res = await fetch("/api/admin/aura/importar", { method: "POST", body: new FormData(form) });
    const d = (await res.json().catch(() => ({}))) as { created?: number; duplicates?: number; conflicts?: number; skipped?: number; errors?: string[]; error?: string };
    setBusy(false);
    setMsg(res.ok ? `Importado: ${d.created} registros pendientes · ${d.duplicates} posibles duplicados · ${d.conflicts} posibles contradicciones · ${d.skipped} omitidos${d.errors?.length ? ` (${d.errors.slice(0, 3).join("; ")})` : ""}.` : d.error);
    router.refresh();
  };
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <button type="button" disabled={busy} onClick={seed} className={btnPrimary}>Cargar conocimiento verificado de la tienda</button>
        <button type="button" onClick={() => setOpen(open === "nueva" ? null : "nueva")} className={btnGhost}>Nueva respuesta</button>
        <button type="button" onClick={() => setOpen(open === "importar" ? null : "importar")} className={btnGhost}>Importar archivo</button>
      </div>
      {msg && <p role="status" className="text-sm">{msg}</p>}
      {open === "nueva" && <EntryForm categories={categories} onDone={() => { setOpen(null); router.refresh(); }} />}
      {open === "importar" && (
        <form onSubmit={(e) => { e.preventDefault(); void upload(e.currentTarget); }} className="space-y-3 rounded-2xl border border-ink/10 bg-ivory/40 p-4">
          <p className="text-xs text-ink-soft">TXT o Markdown (se divide en fragmentos de documento), CSV con columnas <code>pregunta, respuesta, categoria, variantes, fuente, sinteticas</code> (variantes separadas por «|»), o JSON con esos campos. Máximo 3 MB y 5.000 registros. Todo entra pendiente; se marcan duplicados y contradicciones. PDF y DOCX llegarán con el servicio de IA local.</p>
          <input type="file" name="file" accept=".txt,.md,.markdown,.csv,.json" required className="text-sm" />
          <div className="grid gap-3 sm:grid-cols-2">
            <div><label className={labelCls}>Categoría por defecto</label><select name="category" className={inputCls}>{categories.map((c) => <option key={c}>{c}</option>)}</select></div>
            <div><label className={labelCls}>Fuente</label><input name="source" className={inputCls} placeholder="Ej.: Manual de atención 2026" /></div>
          </div>
          <button disabled={busy} className={btnPrimary}>{busy ? "Importando…" : "Importar"}</button>
        </form>
      )}
    </div>
  );
}

export function EntryRowActions({ entry, categories }: { entry: Entry; categories: string[] }) {
  const router = useRouter();
  const [edit, setEdit] = useState(false);
  const [showQ, setShowQ] = useState(false);
  const [err, setErr] = useState<string>();
  const act = async (body: unknown) => {
    setErr(undefined);
    const r = await adminFetch(`/api/admin/aura/conocimiento/${entry.id}`, "POST", body);
    if (!r.ok) setErr(r.error);
    router.refresh();
  };
  return (
    <div className="flex min-w-[220px] flex-col items-end gap-2">
      <div className="flex flex-wrap justify-end gap-1.5">
        {entry.status !== "aprobada" && <button type="button" onClick={() => act({ action: "status", status: "aprobada", includeSynthetic: false })} className={btnPrimary}>Aprobar</button>}
        {entry.status !== "aprobada" && entry.questions.some((q) => q.synthetic) && <button type="button" onClick={() => act({ action: "status", status: "aprobada", includeSynthetic: true })} className={btnGhost}>Aprobar con sintéticas</button>}
        {entry.status !== "desactivada" && <button type="button" onClick={() => act({ action: "status", status: "desactivada" })} className={btnDanger}>Desactivar</button>}
        <button type="button" onClick={() => setEdit((x) => !x)} className={btnGhost}>Editar</button>
        {entry.questions.length > 0 && <button type="button" onClick={() => setShowQ((x) => !x)} className={btnGhost}>Preguntas ({entry.questions.length})</button>}
      </div>
      {err && <p className="text-xs text-error">{err}</p>}
      {showQ && (
        <ul className="w-full space-y-1 rounded-xl bg-ivory/50 p-2 text-xs">
          {entry.questions.map((q) => (
            <li key={q.id} className="flex items-center justify-between gap-2">
              <span>{q.text} {q.synthetic && <em className="text-ink-soft">(sintética)</em>}</span>
              <button type="button" onClick={() => act({ action: "question", questionId: q.id, status: q.status === "aprobada" ? "desactivada" : "aprobada" })} className="shrink-0 underline">{q.status === "aprobada" ? "Quitar" : "Aprobar"}</button>
            </li>
          ))}
        </ul>
      )}
      {edit && <div className="w-[min(560px,80vw)]"><EntryForm initial={entry} categories={categories} onDone={() => { setEdit(false); router.refresh(); }} /></div>}
    </div>
  );
}

export function GapActions({ id }: { id: string; question: string }) {
  const router = useRouter();
  const set = async (status: "resuelta" | "descartada") => { await adminFetch(`/api/admin/aura/vacios/${id}`, "POST", { status }); router.refresh(); };
  return (
    <div className="flex gap-1.5">
      <a href="/admin/aura?tab=conocimiento" className={btnGhost}>Crear o editar respuesta</a>
      <button type="button" onClick={() => set("resuelta")} className={btnPrimary}>Resuelta</button>
      <button type="button" onClick={() => set("descartada")} className={btnGhost}>Descartar</button>
    </div>
  );
}

type TestResult = { decision: string; understood: string; candidates: { id: string; title: string; score: number; coverage: number; answer: string }[] };

export function TestBox() {
  const [q, setQ] = useState("");
  const [pend, setPend] = useState(true);
  const [r, setR] = useState<TestResult | null>(null);
  const run = async () => { const x = await adminFetch<TestResult>("/api/admin/aura/probar", "POST", { question: q, incluirPendientes: pend }); if (x.ok) setR(x.data); };
  const label = { respuesta: "Respondería con la biblioteca (sin IA)", contexto: "Pasaría al modelo con esta información como pista", ninguna: "Pasaría al modelo sin información de la biblioteca" } as const;
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <input className={`${inputCls} max-w-xl`} value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === "Enter" && run()} placeholder="Escribe una pregunta como la haría un cliente" />
        <button type="button" onClick={run} className={btnPrimary}>Probar</button>
      </div>
      <label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={pend} onChange={(e) => setPend(e.target.checked)} /> Incluir entradas pendientes (para revisar antes de aprobar)</label>
      {r && (
        <div className="space-y-2 text-sm">
          <p><strong>{label[r.decision as keyof typeof label] ?? r.decision}</strong> · entendido como «{r.understood}»</p>
          {r.candidates.map((c) => (
            <div key={c.id} className="rounded-xl border border-ink/10 p-3">
              <p className="font-semibold">{c.title} <span className="font-normal text-ink-soft">· puntaje {c.score} · cobertura {c.coverage}</span></p>
              <p className="mt-1 text-xs text-ink-soft">{c.answer}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
