import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import type { ZodType } from "zod";
import { ProductError } from "@/lib/services/admin-products";
import { CategoryError } from "@/lib/services/categories";
import { LifecycleError } from "@/lib/services/order-lifecycle";
import { AuthError } from "@/lib/admin/auth";

/** Lee y valida el JSON del cuerpo; devuelve datos o una respuesta 400 lista para retornar. */
export async function parseBody<T>(req: Request, schema: ZodType<T>): Promise<{ data: T } | { error: NextResponse }> {
  const raw = await req.json().catch(() => undefined);
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    return { error: NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Datos no válidos", details: parsed.error.flatten() }, { status: 400 }) };
  }
  return { data: parsed.data };
}

/** Traduce errores conocidos a respuestas claras; los desconocidos se registran y devuelven un mensaje genérico. */
export function handleError(e: unknown): NextResponse {
  if (e instanceof ProductError || e instanceof CategoryError || e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: e.status });
  if (e instanceof LifecycleError) return NextResponse.json({ error: e.message }, { status: e.code === "NOT_FOUND" ? 404 : 409 });
  if (e instanceof Prisma.PrismaClientKnownRequestError) {
    if (e.code === "P2002") return NextResponse.json({ error: "Ya existe un registro con ese valor (slug o correo duplicado)." }, { status: 409 });
    if (e.code === "P2025") return NextResponse.json({ error: "El registro ya no existe." }, { status: 404 });
    if (e.code === "P2028") return NextResponse.json({ error: "La base de datos tardó demasiado. Inténtalo de nuevo." }, { status: 503 });
  }
  console.error("[admin] error no controlado:", e instanceof Error ? `${e.name}: ${e.message}` : e);
  return NextResponse.json({ error: "Error interno. Inténtalo de nuevo." }, { status: 500 });
}
