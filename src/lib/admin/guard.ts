import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { COOKIE_NAME, readCookie, verifySessionToken } from "./session";

const MUTATING = new Set(["POST", "PUT", "PATCH", "DELETE"]);

/**
 * Debe llamarse al inicio de CADA handler /api/admin/*.
 * Devuelve una respuesta de error si no hay sesión válida, o null si todo está bien.
 */
export async function requireAdminApi(req: Request): Promise<NextResponse | null> {
  const token = readCookie(req.headers.get("cookie"), COOKIE_NAME);
  if (!(await verifySessionToken(token))) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  if (MUTATING.has(req.method)) {
    // Defensa CSRF adicional a SameSite=Strict: el origen debe ser este mismo sitio.
    const origin = req.headers.get("origin");
    const host = req.headers.get("host");
    const sameOrigin = origin ? (() => { try { return new URL(origin).host === host; } catch { return false; } })() : req.headers.get("sec-fetch-site") === "same-origin";
    if (!sameOrigin) return NextResponse.json({ error: "Origen no permitido" }, { status: 403 });
  }
  return null;
}

/** Para páginas/layouts del panel: redirige al login si no hay sesión. */
export async function requireAdminPage(): Promise<void> {
  const jar = await cookies();
  if (!(await verifySessionToken(jar.get(COOKIE_NAME)?.value))) redirect("/admin/login");
}
