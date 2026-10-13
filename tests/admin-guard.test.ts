// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

const session = vi.hoisted(() => ({ current: null as null | { id: string; email: string; name: string; role: "OWNER" | "ADMIN"; sessionId: string } }));
vi.mock("@/lib/admin/auth", () => ({ getSessionAdmin: vi.fn(async (token?: string) => (token ? session.current : null)) }));

import { requireAdmin } from "@/lib/admin/guard";
import { COOKIE_NAME } from "@/lib/admin/session";

const req = (method: string, headers: Record<string, string> = {}) =>
  new Request("http://localhost:3000/api/admin/products", { method, headers: { host: "localhost:3000", ...headers } });
const withCookie = { cookie: `${COOKIE_NAME}=token` };

beforeEach(() => { session.current = { id: "a1", email: "a@7h.co", name: "A", role: "ADMIN", sessionId: "s1" }; });

describe("guard de APIs admin (se ejecuta en CADA handler)", () => {
  it("401 sin cookie o con sesión inválida/revocada", async () => {
    expect((await requireAdmin(req("GET"))).error?.status).toBe(401);
    session.current = null;
    expect((await requireAdmin(req("GET", withCookie))).error?.status).toBe(401);
  });
  it("permite lectura con sesión válida y devuelve quién es", async () => {
    const r = await requireAdmin(req("GET", withCookie));
    expect(r.ctx?.admin.email).toBe("a@7h.co");
  });
  it("403 en escrituras sin Origin o desde otro sitio", async () => {
    expect((await requireAdmin(req("POST", withCookie))).error?.status).toBe(403);
    expect((await requireAdmin(req("DELETE", { ...withCookie, origin: "https://evil.com" }))).error?.status).toBe(403);
    expect((await requireAdmin(req("PATCH", { ...withCookie, origin: "http://localhost:3000" }))).ctx).toBeDefined();
  });
  it("las acciones de dueño exigen rol OWNER", async () => {
    expect((await requireAdmin(req("POST", { ...withCookie, origin: "http://localhost:3000" }), { role: "OWNER" })).error?.status).toBe(403);
    session.current!.role = "OWNER";
    expect((await requireAdmin(req("POST", { ...withCookie, origin: "http://localhost:3000" }), { role: "OWNER" })).ctx).toBeDefined();
  });
});
