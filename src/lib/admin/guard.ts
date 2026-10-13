import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import type { AdminRole } from "@prisma/client";
import { COOKIE_NAME, readCookie } from "./session";
import { getSessionAdmin, type SessionAdmin } from "./auth";
import { getClientIp, isSameOrigin } from "@/lib/request";

const MUTATING = new Set(["POST", "PUT", "PATCH", "DELETE"]);

export interface AdminContext { admin: SessionAdmin; ip: string }

/**
 * Debe llamarse al inicio de CADA handler /api/admin/*. El middleware es solo la primera barrera:
 * aquí se valida la sesión contra la base de datos (revocable), el rol y el origen.
 */
export async function requireAdmin(req: Request, opts: { role?: AdminRole } = {}): Promise<{ ctx: AdminContext; error?: undefined } | { error: NextResponse; ctx?: undefined }> {
  const admin = await getSessionAdmin(readCookie(req.headers.get("cookie"), COOKIE_NAME));
  if (!admin) return { error: NextResponse.json({ error: "No autorizado" }, { status: 401 }) };
  if (MUTATING.has(req.method) && !isSameOrigin(req)) return { error: NextResponse.json({ error: "Origen no permitido" }, { status: 403 }) };
  if (opts.role === "OWNER" && admin.role !== "OWNER") return { error: NextResponse.json({ error: "Solo el dueño de la tienda puede hacer esto." }, { status: 403 }) };
  return { ctx: { admin, ip: getClientIp(req) } };
}

/** Sesión actual en páginas/layouts (una sola consulta por petición gracias a `cache`). */
export const getCurrentAdmin = cache(async (): Promise<SessionAdmin | null> => {
  const jar = await cookies();
  return getSessionAdmin(jar.get(COOKIE_NAME)?.value);
});

/** Para páginas del panel: redirige al login si no hay sesión, o al inicio si falta el rol. */
export async function requireAdminPage(opts: { role?: AdminRole } = {}): Promise<SessionAdmin> {
  const admin = await getCurrentAdmin();
  if (!admin) redirect("/admin/login");
  if (opts.role === "OWNER" && admin.role !== "OWNER") redirect("/admin");
  return admin;
}
