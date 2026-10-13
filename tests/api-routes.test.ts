// @vitest-environment node
/**
 * Pruebas de las rutas reales de /api/admin/* contra la base de datos en memoria:
 * configuración inicial, inicio de sesión, bloqueo por intentos y acceso directo a las APIs sin permiso.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { createFakeDb } from "./helpers/fake-db";

const h = vi.hoisted(() => ({ f: undefined as unknown as ReturnType<typeof createFakeDb> }));
vi.mock("@/lib/prisma", () => ({ get prisma() { return h.f.db; } }));

import { MemoryRateStore, setRateStore } from "@/lib/rate-limit";
import { POST as setup } from "@/app/api/admin/setup/route";
import { POST as login } from "@/app/api/admin/login/route";
import { POST as logout } from "@/app/api/admin/logout/route";
import { POST as createCategoryRoute } from "@/app/api/admin/categories/route";
import { POST as createUser } from "@/app/api/admin/users/route";
import { PUT as updateProductRoute } from "@/app/api/admin/products/[id]/route";
import { PATCH as orderRoute } from "@/app/api/admin/orders/[id]/route";
import { PATCH as stockRoute } from "@/app/api/admin/products/[id]/stock/route";
import { POST as uploadRoute } from "@/app/api/admin/uploads/route";

const env = process.env as Record<string, string | undefined>;
const saved = { pw: env.ADMIN_PASSWORD, secret: env.ADMIN_SESSION_SECRET };
beforeAll(() => { env.ADMIN_PASSWORD = "llave-de-arranque-prueba"; env.ADMIN_SESSION_SECRET = "x".repeat(40); });
afterAll(() => { env.ADMIN_PASSWORD = saved.pw; env.ADMIN_SESSION_SECRET = saved.secret; setRateStore(undefined); });
beforeEach(() => { h.f = createFakeDb(); setRateStore(new MemoryRateStore()); });

const ORIGIN = "http://localhost:3000";
const call = (path: string, method: string, body?: unknown, headers: Record<string, string> = {}) =>
  new Request(`${ORIGIN}${path}`, { method, headers: { host: "localhost:3000", origin: ORIGIN, "content-type": "application/json", "x-real-ip": "10.0.0.1", ...headers }, body: body === undefined ? undefined : JSON.stringify(body) });
const cookieOf = (res: Response) => res.headers.get("set-cookie")?.split(";")[0] ?? "";
const params = (id: string) => ({ params: Promise.resolve({ id }) });
const OWNER = { name: "Dueña", email: "duena@7h.co", password: "frase de prueba muy larga" };

async function ownerCookie() {
  const res = await setup(call("/api/admin/setup", "POST", { setupKey: "llave-de-arranque-prueba", ...OWNER }));
  expect(res.status).toBe(201);
  return cookieOf(res);
}

describe("configuración inicial (/api/admin/setup)", () => {
  it("exige la llave de arranque y solo funciona una vez", async () => {
    expect((await setup(call("/api/admin/setup", "POST", { setupKey: "mala", ...OWNER }))).status).toBe(403);
    const cookie = await ownerCookie();
    expect(cookie).toMatch(/^7h_admin=/);
    expect((await setup(call("/api/admin/setup", "POST", { setupKey: "llave-de-arranque-prueba", ...OWNER, email: "otro@7h.co" }))).status).toBe(409);
    expect(h.f.state.adminUser).toHaveLength(1);
    expect(h.f.state.adminAuditLog.map((a) => a.action)).toContain("auth.setup");
  });
  it("rechaza peticiones desde otro sitio", async () => {
    expect((await setup(call("/api/admin/setup", "POST", { setupKey: "llave-de-arranque-prueba", ...OWNER }, { origin: "https://evil.com" }))).status).toBe(403);
  });
});

describe("inicio de sesión (/api/admin/login)", () => {
  it("cookie HttpOnly + SameSite=Strict con credenciales correctas; error genérico con incorrectas", async () => {
    await ownerCookie();
    const bad = await login(call("/api/admin/login", "POST", { email: OWNER.email, password: "incorrecta incorrecta" }));
    expect(bad.status).toBe(401);
    expect((await bad.json()).error).toBe("Correo o contraseña incorrectos.");
    const unknown = await login(call("/api/admin/login", "POST", { email: "nadie@7h.co", password: "incorrecta incorrecta" }));
    expect((await unknown.json()).error).toBe("Correo o contraseña incorrectos.");
    const ok = await login(call("/api/admin/login", "POST", { email: OWNER.email.toUpperCase(), password: OWNER.password }));
    expect(ok.status).toBe(200);
    const sc = ok.headers.get("set-cookie") ?? "";
    expect(sc).toMatch(/HttpOnly/i);
    expect(sc).toMatch(/SameSite=strict/i);
    expect(sc).not.toContain(OWNER.password);
  });
  it("bloquea tras 5 intentos fallidos aunque después se use la contraseña correcta", async () => {
    await ownerCookie();
    for (let i = 0; i < 5; i++) expect((await login(call("/api/admin/login", "POST", { email: OWNER.email, password: `mala ${i} mala mala` }))).status).toBe(401);
    expect((await login(call("/api/admin/login", "POST", { email: OWNER.email, password: OWNER.password }))).status).toBe(429);
    expect(h.f.state.adminAuditLog.filter((a) => a.action === "auth.login_failed")).toHaveLength(5);
  });
  it("sin administradores indica ir a /admin/setup", async () => {
    const r = await login(call("/api/admin/login", "POST", { email: "a@b.co", password: "x" }));
    expect(r.status).toBe(409);
    expect((await r.json()).setup).toBe(true);
  });
});

describe("acceso directo a las APIs sin permiso", () => {
  it("todas las APIs administrativas responden 401 sin sesión", async () => {
    const results = await Promise.all([
      createCategoryRoute(call("/api/admin/categories", "POST", { label: "Relojes", slug: "relojes" })),
      createUser(call("/api/admin/users", "POST", { name: "X", email: "x@7h.co", password: "frase de prueba muy larga" })),
      updateProductRoute(call("/api/admin/products/p1", "PUT", {}), params("p1")),
      orderRoute(call("/api/admin/orders/o1", "PATCH", { action: "confirm_manual_payment" }), params("o1")),
      stockRoute(call("/api/admin/products/p1/stock", "PATCH", { stock: 99 }), params("p1")),
      uploadRoute(call("/api/admin/uploads", "POST")),
    ]);
    expect(results.map((r) => r.status)).toEqual([401, 401, 401, 401, 401, 401]);
    expect(h.f.state.category).toHaveLength(0);
  });
  it("un ADMIN no puede crear cuentas (solo el dueño)", async () => {
    const owner = await ownerCookie();
    expect((await createUser(call("/api/admin/users", "POST", { name: "Op", email: "op@7h.co", role: "ADMIN", password: "otra frase muy larga" }, { cookie: owner }))).status).toBe(201);
    const opLogin = await login(call("/api/admin/login", "POST", { email: "op@7h.co", password: "otra frase muy larga" }, { "x-real-ip": "10.0.0.2" }));
    const op = cookieOf(opLogin);
    const r = await createUser(call("/api/admin/users", "POST", { name: "Z", email: "z@7h.co", role: "OWNER", password: "otra frase muy larga" }, { cookie: op }));
    expect(r.status).toBe(403);
  });
  it("con sesión: crea la categoría y deja registro en la auditoría; tras cerrar sesión, 401", async () => {
    const owner = await ownerCookie();
    const res = await createCategoryRoute(call("/api/admin/categories", "POST", { label: "Relojes", slug: "relojes" }, { cookie: owner }));
    expect(res.status).toBe(201);
    expect(h.f.state.category.map((c) => c.slug)).toContain("relojes");
    expect(h.f.state.adminAuditLog.find((a) => a.action === "category.created")).toMatchObject({ actorEmail: "duena@7h.co", entityType: "category" });
    expect((await logout(call("/api/admin/logout", "POST", undefined, { cookie: owner }))).status).toBe(200);
    expect((await createCategoryRoute(call("/api/admin/categories", "POST", { label: "Bolsos", slug: "bolsos" }, { cookie: owner }))).status).toBe(401);
  });
  it("una cookie robada de otra tienda (otro secreto) no sirve", async () => {
    await ownerCookie();
    const forged = "7h_admin=eyJleHAiOjk5OTk5OTk5OTl9.firma-falsa";
    expect((await createCategoryRoute(call("/api/admin/categories", "POST", { label: "Relojes", slug: "relojes" }, { cookie: forged }))).status).toBe(401);
  });
});
