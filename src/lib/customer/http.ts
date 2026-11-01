import { NextResponse } from "next/server";
import { z } from "zod";
import { CustomerAuthError } from "./auth";
import { consume, hashedKey, MIN, tooMany } from "@/lib/rate-limit";
import { getClientIp, readJson } from "@/lib/request";

export const emailField = z.string().trim().toLowerCase().max(254).pipe(z.email("Correo no válido"));
export const passwordField = z.string().min(1).max(200);

export async function body<T>(req: Request, schema: z.ZodType<T>) {
  const parsed = schema.safeParse(await readJson(req));
  if (!parsed.success) return { error: NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Datos no válidos" }, { status: 400 }) } as const;
  return { data: parsed.data } as const;
}

/** Límite por IP y por correo (el correo se guarda como hash). */
export async function limit(req: Request, scope: string, email: string | null, perIp: number, perEmail: number, windowMin: number) {
  const ip = await consume(`${scope}:ip:${getClientIp(req)}`, perIp, windowMin * MIN);
  if (!ip.allowed) return tooMany(ip.retryAfterSec);
  if (email) {
    const e = await consume(hashedKey(`${scope}:email`, email), perEmail, windowMin * MIN);
    if (!e.allowed) return tooMany(e.retryAfterSec);
  }
  return null;
}

export function fail(e: unknown) {
  if (e instanceof CustomerAuthError) return NextResponse.json({ error: e.message }, { status: e.status });
  console.error("[cuenta]", e instanceof Error ? e.message : e);
  return NextResponse.json({ error: "Error interno. Inténtalo de nuevo." }, { status: 500 });
}
