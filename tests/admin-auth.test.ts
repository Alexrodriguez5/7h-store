// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createSessionToken, readCookie, verifySessionToken } from "@/lib/admin/session";
import { checkSetupKey, hashPassword, passwordPolicyError, safeEqual, sha256Hex, verifyPassword } from "@/lib/admin/password";
import {
  AuthError, authenticate, createAdmin, createFirstOwner, createPasswordReset, createSession, getSessionAdmin,
  resetPasswordWithToken, revokeAllSessions, revokeSession, setAdminActive, setAdminRole, setPassword,
} from "@/lib/admin/auth";
import { MemoryRateStore, clearLimit, consume, isBlocked, registerHit, setRateStore } from "@/lib/rate-limit";
import { isSameOrigin } from "@/lib/request";
import { createFakeDb } from "./helpers/fake-db";

const env = process.env as Record<string, string | undefined>;
const saved = { pw: env.ADMIN_PASSWORD, secret: env.ADMIN_SESSION_SECRET, site: env.NEXT_PUBLIC_SITE_URL };
beforeEach(() => { env.ADMIN_PASSWORD = "llave de arranque segura"; env.ADMIN_SESSION_SECRET = "s".repeat(40); });
afterEach(() => { env.ADMIN_PASSWORD = saved.pw; env.ADMIN_SESSION_SECRET = saved.secret; env.NEXT_PUBLIC_SITE_URL = saved.site; });

const OWNER = { name: "Dueña", email: "Duena@7h.co", password: "una frase muy larga 2026" };

describe("token de sesión firmado", () => {
  it("acepta un token recién emitido", async () => expect(await verifySessionToken(await createSessionToken())).toBe(true));
  it("rechaza token vacío, malformado o manipulado", async () => {
    const token = await createSessionToken();
    const [payload, sig] = token.split(".");
    expect(await verifySessionToken(undefined)).toBe(false);
    expect(await verifySessionToken("basura")).toBe(false);
    expect(await verifySessionToken(`${payload}x.${sig}`)).toBe(false);
    expect(await verifySessionToken(`${payload}.${sig.slice(0, -2)}AA`)).toBe(false);
  });
  it("rechaza token expirado (8 h)", async () => expect(await verifySessionToken(await createSessionToken(Date.now() - 9 * 3600_000))).toBe(false));
  it("invalida sesiones si cambia el secreto", async () => {
    const token = await createSessionToken();
    env.ADMIN_SESSION_SECRET = "otro-secreto-distinto-de-32-caracteres!!";
    expect(await verifySessionToken(token)).toBe(false);
  });
  it("lee cookies por nombre", () => expect(readCookie("a=1; 7h_admin=xyz; b=2", "7h_admin")).toBe("xyz"));
});

describe("contraseñas (scrypt)", () => {
  it("hashea con sal: el mismo texto da hashes distintos y nunca contiene la contraseña", async () => {
    const a = await hashPassword("una frase muy larga 2026");
    const b = await hashPassword("una frase muy larga 2026");
    expect(a).not.toBe(b);
    expect(a.startsWith("scrypt$")).toBe(true);
    expect(a.includes("frase")).toBe(false);
  });
  it("verifica la correcta y rechaza la incorrecta o un hash manipulado", async () => {
    const h = await hashPassword("una frase muy larga 2026");
    expect(await verifyPassword("una frase muy larga 2026", h)).toBe(true);
    expect(await verifyPassword("una frase muy larga 2027", h)).toBe(false);
    expect(await verifyPassword("x", h.replace("scrypt$32768", "scrypt$999999999"))).toBe(false);
    expect(await verifyPassword("x", "texto-plano")).toBe(false);
  });
  it("política: 12+ caracteres y distinta del correo", () => {
    expect(passwordPolicyError("corta")).toMatch(/12/);
    expect(passwordPolicyError("ana@correo.com", "ana@correo.com")).toMatch(/correo/);
    expect(passwordPolicyError("aaaaaaaaaaaaaa")).toMatch(/simple/);
    expect(passwordPolicyError("una frase muy larga 2026")).toBeNull();
  });
  it("comparación en tiempo constante y llave de arranque", () => {
    expect(safeEqual("abc", "abc")).toBe(true);
    expect(safeEqual("abc", "abcd")).toBe(false);
    expect(checkSetupKey("llave de arranque segura")).toBe(true);
    expect(checkSetupKey("otra")).toBe(false);
    delete env.ADMIN_PASSWORD;
    expect(checkSetupKey("")).toBe(false);
  });
});

describe("cuentas y sesiones administrativas", () => {
  let f: ReturnType<typeof createFakeDb>;
  beforeEach(() => { f = createFakeDb(); });

  it("el primer dueño solo se puede crear una vez", async () => {
    const owner = await createFirstOwner(OWNER, f.db);
    expect(owner.role).toBe("OWNER");
    expect(owner.email).toBe("duena@7h.co");
    expect(f.state.adminUser[0].passwordHash).not.toContain("frase");
    await expect(createFirstOwner({ ...OWNER, email: "otro@7h.co" }, f.db)).rejects.toMatchObject({ status: 409 });
    expect(f.state.adminUser).toHaveLength(1);
  });
  it("rechaza contraseñas débiles al crear cuentas", async () => {
    await expect(createFirstOwner({ ...OWNER, password: "123" }, f.db)).rejects.toBeInstanceOf(AuthError);
  });
  it("autentica por correo (sin distinguir mayúsculas) y rechaza contraseña o cuenta incorrectas", async () => {
    await createFirstOwner(OWNER, f.db);
    expect(await authenticate("DUENA@7h.co", OWNER.password, f.db)).toMatchObject({ email: "duena@7h.co" });
    expect(await authenticate("duena@7h.co", "incorrecta incorrecta", f.db)).toBeNull();
    expect(await authenticate("nadie@7h.co", OWNER.password, f.db)).toBeNull();
  });
  it("una cuenta desactivada no puede entrar ni conservar sesiones", async () => {
    const owner = await createFirstOwner(OWNER, f.db);
    const admin = await createAdmin({ name: "Op", email: "op@7h.co", password: "otra frase larga 2026", role: "ADMIN" }, f.db);
    const token = await createSession(admin.id, {}, f.db);
    expect(await getSessionAdmin(token, f.db)).toMatchObject({ email: "op@7h.co", role: "ADMIN" });
    await setAdminActive(owner.id, admin.id, false, f.db);
    expect(await getSessionAdmin(token, f.db)).toBeNull();
    expect(await authenticate("op@7h.co", "otra frase larga 2026", f.db)).toBeNull();
  });
  it("la sesión se guarda como hash, se puede revocar y vence", async () => {
    const owner = await createFirstOwner(OWNER, f.db);
    const token = await createSession(owner.id, { ip: "1.2.3.4" }, f.db);
    expect(f.state.adminSession[0].tokenHash).toBe(sha256Hex(token));
    expect(JSON.stringify(f.state.adminSession)).not.toContain(token);
    const s = await getSessionAdmin(token, f.db);
    expect(s?.id).toBe(owner.id);
    await revokeSession(s!.sessionId, f.db);
    expect(await getSessionAdmin(token, f.db)).toBeNull();
    const t2 = await createSession(owner.id, {}, f.db);
    expect(await getSessionAdmin(t2, f.db, Date.now() + 9 * 3600_000)).toBeNull();
  });
  it("un token con firma válida pero sin registro en la BD no da acceso", async () => {
    expect(await getSessionAdmin(await createSessionToken(), f.db)).toBeNull();
  });
  it("cambiar la contraseña cierra todas las sesiones", async () => {
    const owner = await createFirstOwner(OWNER, f.db);
    const a = await createSession(owner.id, {}, f.db);
    const b = await createSession(owner.id, {}, f.db);
    await setPassword(owner.id, "nueva frase segura 2027", f.db);
    expect(await getSessionAdmin(a, f.db)).toBeNull();
    expect(await getSessionAdmin(b, f.db)).toBeNull();
    expect(await authenticate(OWNER.email, "nueva frase segura 2027", f.db)).not.toBeNull();
  });
  it("no se puede desactivar ni degradar al último dueño, ni a uno mismo", async () => {
    const owner = await createFirstOwner(OWNER, f.db);
    const admin = await createAdmin({ name: "Op", email: "op@7h.co", password: "otra frase larga 2026", role: "ADMIN" }, f.db);
    await expect(setAdminActive(owner.id, owner.id, false, f.db)).rejects.toMatchObject({ status: 409 });
    await expect(setAdminRole(admin.id, owner.id, "ADMIN", f.db)).rejects.toMatchObject({ status: 409 });
    await setAdminRole(owner.id, admin.id, "OWNER", f.db);
    await setAdminRole(admin.id, owner.id, "ADMIN", f.db); // ya hay otro dueño activo
    expect(f.state.adminUser.find((u) => u.id === owner.id)!.role).toBe("ADMIN");
  });
  it("no hay correos duplicados", async () => {
    await createFirstOwner(OWNER, f.db);
    await expect(createAdmin({ name: "X", email: "duena@7h.co", password: "otra frase larga 2026", role: "ADMIN" }, f.db)).rejects.toMatchObject({ status: 409 });
  });
  it("revokeAllSessions cierra todo", async () => {
    const owner = await createFirstOwner(OWNER, f.db);
    await createSession(owner.id, {}, f.db);
    await createSession(owner.id, {}, f.db);
    expect(await revokeAllSessions(owner.id, f.db)).toBe(2);
  });
});

describe("recuperación de contraseña", () => {
  let f: ReturnType<typeof createFakeDb>;
  beforeEach(() => { f = createFakeDb(); });

  it("no revela si la cuenta existe (devuelve null) y no crea tokens", async () => {
    expect(await createPasswordReset("nadie@7h.co", f.db)).toBeNull();
    expect(f.state.adminPasswordReset).toHaveLength(0);
  });
  it("guarda solo el hash del token; es de un solo uso y cierra las sesiones", async () => {
    const owner = await createFirstOwner(OWNER, f.db);
    const session = await createSession(owner.id, {}, f.db);
    const r = await createPasswordReset(OWNER.email, f.db);
    expect(f.state.adminPasswordReset[0].tokenHash).toBe(sha256Hex(r!.token));
    expect(JSON.stringify(f.state.adminPasswordReset)).not.toContain(r!.token);
    await resetPasswordWithToken(r!.token, "frase restablecida 2026", f.db);
    expect(await getSessionAdmin(session, f.db)).toBeNull();
    expect(await authenticate(OWNER.email, "frase restablecida 2026", f.db)).not.toBeNull();
    await expect(resetPasswordWithToken(r!.token, "otra frase restablecida", f.db)).rejects.toMatchObject({ status: 400 });
  });
  it("un token vencido o reemplazado por uno nuevo no sirve", async () => {
    await createFirstOwner(OWNER, f.db);
    const old = await createPasswordReset(OWNER.email, f.db);
    const fresh = await createPasswordReset(OWNER.email, f.db);
    await expect(resetPasswordWithToken(old!.token, "frase restablecida 2026", f.db)).rejects.toMatchObject({ status: 400 });
    await expect(resetPasswordWithToken(fresh!.token, "frase restablecida 2026", f.db, Date.now() + 31 * 60_000)).rejects.toMatchObject({ status: 400 });
    await expect(resetPasswordWithToken("token-inventado-de-prueba-123", "frase restablecida 2026", f.db)).rejects.toMatchObject({ status: 400 });
  });
});

describe("límite de intentos persistente", () => {
  beforeEach(() => setRateStore(new MemoryRateStore()));
  afterEach(() => setRateStore(undefined));

  it("bloquea el login tras 5 fallos del mismo correo y se libera al vencer la ventana", async () => {
    const key = "login:email:ana@x.co";
    const now = Date.now();
    for (let i = 0; i < 4; i++) await registerHit(key, 15 * 60_000, now);
    expect(await isBlocked(key, 5, now)).toBe(false);
    await registerHit(key, 15 * 60_000, now);
    expect(await isBlocked(key, 5, now)).toBe(true);
    expect(await isBlocked(key, 5, now + 16 * 60_000)).toBe(false);
    await clearLimit(key);
    expect(await isBlocked(key, 5, now)).toBe(false);
  });
  it("consume cuenta peticiones y devuelve cuánto esperar", async () => {
    const now = Date.now();
    for (let i = 0; i < 3; i++) expect((await consume("x", 3, 60_000, now)).allowed).toBe(true);
    const r = await consume("x", 3, 60_000, now);
    expect(r.allowed).toBe(false);
    expect(r.retryAfterSec).toBe(60);
  });
  it("si el almacén falla, no tumba la tienda (fail-open) y lo registra", async () => {
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    setRateStore({ hit: async () => { throw new Error("db caída"); }, peek: async () => { throw new Error("db caída"); }, reset: async () => {} });
    expect((await consume("y", 1, 1000)).allowed).toBe(true);
    expect(await isBlocked("y", 1)).toBe(false);
    expect(err).toHaveBeenCalled();
    err.mockRestore();
  });
});

describe("mismo origen (CSRF)", () => {
  const req = (h: Record<string, string>) => new Request("http://localhost:3000/api/admin/x", { method: "POST", headers: h });
  it("acepta el mismo host, el host reenviado por un túnel y el dominio público", () => {
    expect(isSameOrigin(req({ host: "localhost:3000", origin: "http://localhost:3000" }))).toBe(true);
    expect(isSameOrigin(req({ host: "localhost:3000", "x-forwarded-host": "abc-3000.use.devtunnels.ms", origin: "https://abc-3000.use.devtunnels.ms" }))).toBe(true);
    env.NEXT_PUBLIC_SITE_URL = "https://7hstore.co";
    expect(isSameOrigin(req({ host: "interno:3000", origin: "https://7hstore.co" }))).toBe(true);
  });
  it("rechaza otros orígenes y peticiones sin Origin que no sean same-origin", () => {
    expect(isSameOrigin(req({ host: "localhost:3000", origin: "https://evil.com" }))).toBe(false);
    expect(isSameOrigin(req({ host: "localhost:3000" }))).toBe(false);
    expect(isSameOrigin(req({ host: "localhost:3000", "sec-fetch-site": "same-origin" }))).toBe(true);
  });
});
