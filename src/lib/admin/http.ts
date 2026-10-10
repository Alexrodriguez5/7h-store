import { NextResponse } from "next/server";
import type { ZodType } from "zod";
import { ProductError } from "@/lib/services/admin-products";
import { LifecycleError } from "@/lib/services/order-lifecycle";

/** Lee y valida el JSON del cuerpo; devuelve datos o una respuesta 400 lista para retornar. */
export async function parseBody<T>(req: Request, schema: ZodType<T>): Promise<{ data: T } | { error: NextResponse }> {
  const raw = await req.json().catch(() => undefined);
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    return { error: NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Datos no válidos", details: parsed.error.flatten() }, { status: 400 }) };
  }
  return { data: parsed.data };
}

export function handleError(e: unknown): NextResponse {
  if (e instanceof ProductError) return NextResponse.json({ error: e.message }, { status: e.status });
  if (e instanceof LifecycleError) return NextResponse.json({ error: e.message }, { status: e.code === "NOT_FOUND" ? 404 : 409 });
  return NextResponse.json({ error: "Error interno. Inténtalo de nuevo." }, { status: 500 });
}
