import { NextResponse, type NextRequest } from "next/server";
import { COOKIE_NAME, verifySessionToken } from "@/lib/admin/session";

/** Páginas y APIs del panel accesibles SIN sesión (acceso, primer dueño y recuperación de contraseña). */
const PUBLIC_PATHS = new Set([
  "/admin/login",
  "/admin/setup",
  "/admin/recuperar",
  "/admin/restablecer",
  "/api/admin/login",
  "/api/admin/setup",
  "/api/admin/password-reset/request",
  "/api/admin/password-reset/confirm",
]);

/**
 * Primera barrera para /admin y /api/admin (verifica la FIRMA del token, sin base de datos).
 * No es la única: cada página y cada handler vuelve a validar la sesión contra la base de datos
 * (requireAdminPage / requireAdmin), donde se comprueba si fue revocada.
 */
export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (PUBLIC_PATHS.has(pathname)) return NextResponse.next();

  const ok = await verifySessionToken(req.cookies.get(COOKIE_NAME)?.value);
  if (ok) return NextResponse.next();

  if (pathname.startsWith("/api/")) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const url = req.nextUrl.clone();
  url.pathname = "/admin/login";
  url.search = "";
  return NextResponse.redirect(url);
}

export const config = { matcher: ["/admin/:path*", "/api/admin/:path*"] };
