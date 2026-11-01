import { NextResponse } from "next/server";
import type { z } from "zod";
import type { EvidenceFile } from "@/lib/services/support";
import { MAX_EVIDENCE_TOTAL } from "@/lib/support";

/** Lee un formulario multipart: campo "data" (JSON validado con zod) + archivos "files". */
export async function readMultipart<T>(req: Request, schema: z.ZodType<T>) {
  const len = Number(req.headers.get("content-length") ?? 0);
  if (len > MAX_EVIDENCE_TOTAL + 200_000) return { error: NextResponse.json({ error: "Los archivos superan 4 MB en total." }, { status: 413 }) } as const;
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return { error: NextResponse.json({ error: "Formulario no válido." }, { status: 400 }) } as const;
  }
  let raw: unknown;
  try {
    raw = JSON.parse(String(form.get("data") ?? "{}"));
  } catch {
    raw = undefined;
  }
  const parsed = schema.safeParse(raw);
  if (!parsed.success) return { error: NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Datos no válidos" }, { status: 400 }) } as const;
  const files: EvidenceFile[] = [];
  for (const f of form.getAll("files")) {
    if (typeof f === "string" || f.size === 0) continue;
    files.push({ name: f.name, bytes: new Uint8Array(await f.arrayBuffer()) });
  }
  return { data: parsed.data, files } as const;
}
