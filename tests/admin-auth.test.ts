// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { COOKIE_NAME, createSessionToken, readCookie, verifySessionToken } from "@/lib/admin/session";
import { checkAdminPassword, clearFailures, isRateLimited, registerFailure, safeEqual } from "@/lib/admin/password";
import { requireAdminApi } from "@/lib/admin/guard";

const env = process.env as Record<string, string | undefined>;
const saved = { pw: env.ADMIN_PASSWORD, secret: env.ADMIN_SESSION_SECRET };
beforeEach(() => { env.ADMIN_PASSWORD = "correct horse battery staple"; delete env.ADMIN_SESSION_SECRET; });
afterEach(() => { env.ADMIN_PASSWORD = saved.pw; env.ADMIN_SESSION_SECRET = saved.secret; });

describe("sesión administrativa", () => {
  it("acepta un token recién emitido", async () => expect(await verifySessionToken(await createSessionToken())).toBe(true));
  it("rechaza token vacío, malformado o manipulado", async () => {
    const token = await createSessionToken();
    const [payload, sig] = token.split(".");
    expect(await verifySessionToken(undefined)).toBe(false);
    expect(await verifySessionToken("basura")).toBe(false);
    expect(await verifySessionToken(`${payload}x.${sig}`)).toBe(false);
    expect(await verifySessionToken(`${payload}.${sig.slice(0, -2)}AA`)).toBe(false);
  });
  it("rechaza token expirado (8 h)", async () => {
    const token = await createSessionToken(Date.now() - 9 * 3600_000);
    expect(await verifySessionToken(token)).toBe(false);
  });
  it("invalida sesiones si cambia el secreto", async () => {
    const token = await createSessionToken();
    env.ADMIN_PASSWORD = "otra contraseña distinta";
    expect(await verifySessionToken(token)).toBe(false);
  });
  it("sin ADMIN_PASSWORD no hay sesiones válidas", async () => {
    const token = await createSessionToken();
    delete env.ADMIN_PASSWORD;
    expect(await verifySessionToken(token)).toBe(false);
  });
  it("el token no contiene la contraseña", async () => expect((await createSessionToken()).includes("correct")).toBe(false));
});

describe("contraseña y límite de intentos", () => {
  it("compara en tiempo constante", () => { expect(safeEqual("abc", "abc")).toBe(true); expect(safeEqual("abc", "abd")).toBe(false); expect(safeEqual("abc", "abcd")).toBe(false); });
  it("valida contra ADMIN_PASSWORD", () => { expect(checkAdminPassword("correct horse battery staple")).toBe(true); expect(checkAdminPassword("nope")).toBe(false); });
  it("bloquea tras 5 fallos", () => {
    const ip = "9.9.9.9";
    clearFailures(ip);
    for (let i = 0; i < 4; i++) registerFailure(ip);
    expect(isRateLimited(ip)).toBe(false);
    registerFailure(ip);
    expect(isRateLimited(ip)).toBe(true);
    clearFailures(ip);
  });
});

describe("guard de APIs admin", () => {
  const req = (method: string, headers: Record<string, string> = {}) => new Request("http://localhost:3000/api/admin/products", { method, headers: { host: "localhost:3000", ...headers } });
  it("401 sin cookie", async () => expect((await requireAdminApi(req("GET")))?.status).toBe(401));
  it("401 con cookie falsa", async () => expect((await requireAdminApi(req("GET", { cookie: `${COOKIE_NAME}=falsa` })))?.status).toBe(401));
  it("permite GET con sesión válida", async () => expect(await requireAdminApi(req("GET", { cookie: `${COOKIE_NAME}=${await createSessionToken()}` }))).toBeNull());
  it("403 en escritura sin Origin", async () => expect((await requireAdminApi(req("POST", { cookie: `${COOKIE_NAME}=${await createSessionToken()}` })))?.status).toBe(403));
  it("403 en escritura desde otro origen", async () => expect((await requireAdminApi(req("DELETE", { cookie: `${COOKIE_NAME}=${await createSessionToken()}`, origin: "https://evil.com" })))?.status).toBe(403));
  it("permite escritura del mismo origen con sesión", async () => expect(await requireAdminApi(req("PATCH", { cookie: `${COOKIE_NAME}=${await createSessionToken()}`, origin: "http://localhost:3000" }))).toBeNull());
  it("lee cookies por nombre", () => expect(readCookie("a=1; 7h_admin=xyz; b=2", "7h_admin")).toBe("xyz"));
});
