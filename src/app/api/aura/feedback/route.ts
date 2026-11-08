import { NextResponse } from "next/server";
import { z } from "zod";
import { recordGap } from "@/lib/aura/library/service";
import { consume, MIN, tooMany } from "@/lib/rate-limit";
import { getClientIp, isSameOrigin, readJson } from "@/lib/request";

const input = z.object({ entryId: z.string().trim().min(1).max(40), question: z.string().trim().max(500).default("") });

/** "No me sirvió" en una respuesta de la biblioteca → queda en Aprendizaje y calidad para que el equipo la revise. */
export async function POST(req: Request) {
  if (!isSameOrigin(req)) return NextResponse.json({ error: "Origen no permitido" }, { status: 403 });
  const limit = await consume(`aura:feedback:${getClientIp(req)}`, 20, 60 * MIN);
  if (!limit.allowed) return tooMany(limit.retryAfterSec);
  const p = input.safeParse(await readJson(req));
  if (!p.success) return NextResponse.json({ error: "Datos no válidos" }, { status: 400 });
  // recordGap vuelve a pasar el texto por el filtro de privacidad antes de guardarlo.
  await recordGap(p.data.question || "(sin texto)", "incorrecta", { entryId: p.data.entryId }).catch(() => undefined);
  return NextResponse.json({ ok: true });
}
