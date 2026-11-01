// @vitest-environment node
/** Google OAuth (URI de regreso por dominio, PKCE, errores de Google) y barrera de pagos reales fuera de producción. */
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createHash } from "node:crypto";
import { buildGoogleAuth, exchangeGoogleCode, googleRedirectUri } from "@/lib/customer/google";
import { assertSafePaymentEnvironment } from "@/lib/payments/wompi";
import { runtimeDatabaseUrl } from "@/lib/db-url";

beforeEach(() => { process.env.GOOGLE_CLIENT_ID = "cliente-de-prueba.apps.googleusercontent.com"; process.env.GOOGLE_CLIENT_SECRET = "secreto-de-prueba"; });
afterEach(() => { delete process.env.GOOGLE_CLIENT_ID; delete process.env.GOOGLE_CLIENT_SECRET; });

describe("Google OAuth", () => {
  it("la URI de regreso usa el dominio por el que entró el cliente (producción, Preview o local)", () => {
    expect(googleRedirectUri("https://7h-store.vercel.app")).toBe("https://7h-store.vercel.app/api/cuenta/google/callback");
    expect(googleRedirectUri("http://localhost:3000/")).toBe("http://localhost:3000/api/cuenta/google/callback");
  });
  it("arma la URL de Google con PKCE S256, state y alcances mínimos; el secreto nunca va en la URL", () => {
    const { url, cookie } = buildGoogleAuth("/cuenta/pedidos/7H-K4M9QX", "https://preview.example.app");
    const u = new URL(url);
    const saved = JSON.parse(cookie);
    expect(u.origin + u.pathname).toBe("https://accounts.google.com/o/oauth2/v2/auth");
    expect(u.searchParams.get("redirect_uri")).toBe("https://preview.example.app/api/cuenta/google/callback");
    expect(u.searchParams.get("scope")).toBe("openid email profile");
    expect(u.searchParams.get("state")).toBe(saved.state);
    expect(u.searchParams.get("code_challenge")).toBe(createHash("sha256").update(saved.verifier).digest("base64url"));
    expect(url).not.toContain("secreto-de-prueba");
    expect(saved.next).toBe("/cuenta/pedidos/7H-K4M9QX");
  });
  it("canjea el código con la misma URI de regreso y devuelve el perfil verificado", async () => {
    const calls: { url: string; body?: string }[] = [];
    const fake = (async (url: string, init?: RequestInit) => {
      calls.push({ url, body: init?.body?.toString() });
      if (url.includes("/token")) return new Response(JSON.stringify({ access_token: "at" }));
      return new Response(JSON.stringify({ sub: "g-1", email: "ana@gmail.com", email_verified: true, name: "Ana" }));
    }) as typeof fetch;
    const p = await exchangeGoogleCode("code-1", "verifier-1", "https://7h-store.vercel.app", fake);
    expect(p).toMatchObject({ sub: "g-1", email: "ana@gmail.com", emailVerified: true });
    const body = new URLSearchParams(calls[0].body);
    expect(body.get("redirect_uri")).toBe("https://7h-store.vercel.app/api/cuenta/google/callback");
    expect(body.get("code_verifier")).toBe("verifier-1");
  });
  it("informa el motivo cuando Google rechaza el canje (invalid_client, invalid_grant)", async () => {
    const fake = (async () => new Response(JSON.stringify({ error: "invalid_client" }), { status: 401 })) as unknown as typeof fetch;
    await expect(exchangeGoogleCode("c", "v", "https://x.app", fake)).rejects.toThrow(/invalid_client/);
  });
});

describe("barrera de pagos reales", () => {
  it("bloquea llaves reales de Wompi en Preview y en local", () => {
    expect(() => assertSafePaymentEnvironment("pub_prod_x", { VERCEL_ENV: "preview" })).toThrow(/Sandbox/);
    expect(() => assertSafePaymentEnvironment("pub_prod_x", { NODE_ENV: "development" })).toThrow();
  });
  it("permite Sandbox en cualquier entorno y llaves reales solo en producción", () => {
    expect(() => assertSafePaymentEnvironment("pub_test_x", { VERCEL_ENV: "preview" })).not.toThrow();
    expect(() => assertSafePaymentEnvironment("pub_prod_x", { VERCEL_ENV: "production" })).not.toThrow();
  });
});

describe("conexión a la base de datos en Vercel", () => {
  const session = "postgresql://user:pw@aws-0-ca-central-1.pooler.supabase.com:5432/postgres";
  it("en Vercel usa el pooler de transacciones con 1 conexión por instancia", () => {
    const u = new URL(runtimeDatabaseUrl(session, { VERCEL: "1" })!);
    expect(u.port).toBe("6543");
    expect(u.searchParams.get("pgbouncer")).toBe("true");
    expect(u.searchParams.get("connection_limit")).toBe("1");
  });
  it("en local deja el puerto y limita el grupo de conexiones", () => {
    const u = new URL(runtimeDatabaseUrl(session, {})!);
    expect(u.port).toBe("5432");
    expect(u.searchParams.get("connection_limit")).toBe("5");
  });
});
