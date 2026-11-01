/**
 * Inicio de sesión con Google (OAuth 2.0 / OpenID Connect, flujo "authorization code" con PKCE y state).
 * Variables (solo servidor): GOOGLE_CLIENT_ID y GOOGLE_CLIENT_SECRET (Google Cloud → Credenciales → ID de cliente OAuth "Aplicación web").
 * URI de redirección autorizada: <NEXT_PUBLIC_SITE_URL>/api/cuenta/google/callback
 */
import { createHash } from "node:crypto";
import { randomToken } from "@/lib/admin/password";
import { siteUrl } from "@/lib/seo";

export const isGoogleConfigured = () => !!process.env.GOOGLE_CLIENT_ID?.trim() && !!process.env.GOOGLE_CLIENT_SECRET?.trim();
/**
 * URI de regreso de Google. Se arma con el dominio por el que entró el cliente (producción, Preview o localhost),
 * no con NEXT_PUBLIC_SITE_URL: así el regreso cae en el mismo sitio donde quedó la cookie de seguridad.
 * Google solo acepta las URI registradas en la credencial, por lo que un dominio ajeno no sirve de nada.
 */
export const googleRedirectUri = (origin?: string) => `${(origin ?? siteUrl()).replace(/\/+$/, "")}/api/cuenta/google/callback`;
export const GOOGLE_STATE_COOKIE = "7h_google_oauth";

/** Solo rutas internas como destino después de iniciar sesión (evita redirecciones abiertas). */
export const safeNext = (n: string | null | undefined) => (n && /^\/(?!\/)[\w\-/?=&%.]*$/.test(n) ? n.slice(0, 200) : "/cuenta/pedidos");

export function buildGoogleAuth(next: string, origin?: string) {
  const state = randomToken(24);
  const verifier = randomToken(48);
  const challenge = createHash("sha256").update(verifier).digest("base64url");
  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID!.trim(),
    redirect_uri: googleRedirectUri(origin),
    response_type: "code",
    scope: "openid email profile",
    state,
    code_challenge: challenge,
    code_challenge_method: "S256",
    prompt: "select_account",
  });
  return { url: `https://accounts.google.com/o/oauth2/v2/auth?${params}`, cookie: JSON.stringify({ state, verifier, next: safeNext(next) }) };
}

export interface GoogleProfile { sub: string; email: string; emailVerified: boolean; name: string | null; picture: string | null }

/** Canjea el código y lee el perfil (por el canal servidor a servidor con Google: no depende del navegador). */
export async function exchangeGoogleCode(code: string, verifier: string, origin?: string, fetchImpl: typeof fetch = fetch): Promise<GoogleProfile> {
  const tokenRes = await fetchImpl("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code, code_verifier: verifier, grant_type: "authorization_code", redirect_uri: googleRedirectUri(origin),
      client_id: process.env.GOOGLE_CLIENT_ID!.trim(), client_secret: process.env.GOOGLE_CLIENT_SECRET!.trim(),
    }),
    signal: AbortSignal.timeout(10_000),
  });
  if (!tokenRes.ok) {
    // invalid_client = ID/secreto mal copiados; invalid_grant = código vencido o URI distinta a la registrada.
    const err = (await tokenRes.json().catch(() => ({}))) as { error?: string };
    throw new Error(`Google token ${tokenRes.status} ${err.error ?? ""}`.trim());
  }
  const { access_token } = (await tokenRes.json()) as { access_token?: string };
  if (!access_token) throw new Error("Google no devolvió access_token");
  const infoRes = await fetchImpl("https://openidconnect.googleapis.com/v1/userinfo", { headers: { Authorization: `Bearer ${access_token}` }, signal: AbortSignal.timeout(10_000) });
  if (!infoRes.ok) throw new Error(`Google userinfo ${infoRes.status}`);
  const u = (await infoRes.json()) as { sub?: string; email?: string; email_verified?: boolean; name?: string; picture?: string };
  if (!u.sub || !u.email) throw new Error("Perfil de Google incompleto");
  return { sub: u.sub, email: u.email, emailVerified: u.email_verified === true, name: u.name ?? null, picture: u.picture ?? null };
}
