/**
 * Token de sesión administrativa: firmado con HMAC-SHA256 (Web Crypto, funciona en Node y en el
 * runtime Edge del middleware). La firma es la primera barrera; la sesión además debe existir y no
 * estar revocada en la tabla AdminSession (ver lib/admin/auth.ts). Nunca contiene contraseñas.
 */
const SESSION_TTL_SECONDS = 8 * 60 * 60;

export const IS_PROD = process.env.NODE_ENV === "production";
export const COOKIE_NAME = IS_PROD ? "__Host-7h_admin" : "7h_admin";
export const SESSION_MAX_AGE = SESSION_TTL_SECONDS;

const enc = new TextEncoder();

function signingSecret(): string | null {
  const dedicated = process.env.ADMIN_SESSION_SECRET;
  if (dedicated && dedicated.length >= 16) return dedicated;
  // Respaldo para no romper instalaciones existentes. En producción define ADMIN_SESSION_SECRET (32+ caracteres aleatorios).
  const pw = process.env.ADMIN_PASSWORD;
  return pw ? `7h-admin-session:${pw}` : null;
}

const b64u = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const fromB64u = (s: string) => Uint8Array.from(atob(s.replace(/-/g, "+").replace(/_/g, "/")), (c) => c.charCodeAt(0));

async function hmacKey(usage: "sign" | "verify", secret: string) {
  return crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, [usage]);
}

export async function createSessionToken(nowMs = Date.now()): Promise<string> {
  const secret = signingSecret();
  if (!secret) throw new Error("ADMIN_SESSION_SECRET no configurada");
  const nonce = crypto.getRandomValues(new Uint8Array(12));
  const payload = b64u(enc.encode(JSON.stringify({ exp: Math.floor(nowMs / 1000) + SESSION_TTL_SECONDS, n: b64u(nonce) })));
  const sig = new Uint8Array(await crypto.subtle.sign("HMAC", await hmacKey("sign", secret), enc.encode(payload)));
  return `${payload}.${b64u(sig)}`;
}

export async function verifySessionToken(token: string | undefined | null, nowMs = Date.now()): Promise<boolean> {
  try {
    const secret = signingSecret();
    if (!secret || !token) return false;
    const [payload, sig, extra] = token.split(".");
    if (!payload || !sig || extra !== undefined) return false;
    const valid = await crypto.subtle.verify("HMAC", await hmacKey("verify", secret), fromB64u(sig), enc.encode(payload));
    if (!valid) return false;
    const { exp } = JSON.parse(new TextDecoder().decode(fromB64u(payload))) as { exp?: number };
    return typeof exp === "number" && exp > Math.floor(nowMs / 1000);
  } catch {
    return false;
  }
}

export function readCookie(header: string | null, name: string): string | undefined {
  if (!header) return undefined;
  for (const part of header.split(";")) {
    const i = part.indexOf("=");
    if (i > 0 && part.slice(0, i).trim() === name) return decodeURIComponent(part.slice(i + 1).trim());
  }
  return undefined;
}

type CookieJar = { set: (name: string, value: string, opts: Record<string, unknown>) => unknown };

/** Cookie de sesión: HttpOnly, SameSite=Strict, Secure y prefijo __Host- en producción. */
export function setSessionCookie(res: { cookies: CookieJar }, token: string) {
  res.cookies.set(COOKIE_NAME, token, { httpOnly: true, secure: IS_PROD, sameSite: "strict", path: "/", maxAge: SESSION_MAX_AGE });
}

export function clearSessionCookie(res: { cookies: CookieJar }) {
  res.cookies.set(COOKIE_NAME, "", { httpOnly: true, secure: IS_PROD, sameSite: "strict", path: "/", maxAge: 0 });
}
