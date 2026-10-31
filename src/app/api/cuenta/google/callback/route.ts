import { NextResponse } from "next/server";
import { createCustomerSession, CustomerAuthError, setCustomerCookie, signInVerifiedEmail } from "@/lib/customer/auth";
import { GOOGLE_STATE_COOKIE, exchangeGoogleCode, isGoogleConfigured, safeNext } from "@/lib/customer/google";
import { safeEqual } from "@/lib/admin/password";
import { readCookieValue } from "@/lib/request";

/** Regreso desde Google: valida state (CSRF) y PKCE, exige correo verificado por Google y abre la sesión. */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const fail = (aviso: string) => {
    const r = NextResponse.redirect(new URL(`/cuenta?aviso=${aviso}`, url));
    r.cookies.set(GOOGLE_STATE_COOKIE, "", { path: "/api/cuenta/google", maxAge: 0 });
    return r;
  };
  if (!isGoogleConfigured()) return fail("google-no-disponible");
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  let saved: { state?: string; verifier?: string; next?: string } = {};
  try {
    saved = JSON.parse(readCookieValue(req, GOOGLE_STATE_COOKIE) ?? "{}");
  } catch {
    /* cookie dañada */
  }
  if (!code || !state || !saved.state || !saved.verifier || !safeEqual(state, saved.state)) return fail("google-error");
  try {
    const profile = await exchangeGoogleCode(code, saved.verifier);
    if (!profile.emailVerified) return fail("google-correo-sin-verificar");
    const customer = await signInVerifiedEmail({ email: profile.email, name: profile.name, avatarUrl: profile.picture, provider: "google", providerUserId: profile.sub });
    const res = NextResponse.redirect(new URL(safeNext(saved.next), url));
    res.cookies.set(GOOGLE_STATE_COOKIE, "", { path: "/api/cuenta/google", maxAge: 0 });
    setCustomerCookie(res, await createCustomerSession(customer.id, req));
    return res;
  } catch (e) {
    if (e instanceof CustomerAuthError) return fail("cuenta-bloqueada");
    console.error("[google]", e instanceof Error ? e.message : e);
    return fail("google-error");
  }
}
