// @vitest-environment node
/** Cuentas de clientes: sesiones, códigos de un solo uso, antitoma de cuenta y redirecciones seguras. */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createFakeDb } from "./helpers/fake-db";

const h = vi.hoisted(() => ({ f: undefined as unknown as ReturnType<typeof createFakeDb> }));
vi.mock("@/lib/prisma", () => ({ get prisma() { return h.f.db; } }));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => undefined }) }));

import { CUSTOMER_COOKIE, OTP_MAX_ATTEMPTS, consumeToken, createCustomerSession, customerFromToken, issueToken, requireCustomer, signInVerifiedEmail } from "@/lib/customer/auth";
import { safeNext } from "@/lib/customer/google";

const req = (method = "GET", headers: Record<string, string> = {}) => new Request("http://localhost:3000/api/cuenta/perfil", { method, headers });

beforeEach(() => { h.f = createFakeDb(); });

describe("sesiones", () => {
  it("la cookie lleva un token aleatorio y la base solo guarda su hash", async () => {
    h.f.state.customer.push({ id: "c1", email: "ana@correo.co", name: "Ana", emailVerifiedAt: new Date(), blockedAt: null });
    const token = await createCustomerSession("c1", req());
    expect(token.length).toBeGreaterThan(30);
    expect(JSON.stringify(h.f.state.customerSession)).not.toContain(token);
    expect((await customerFromToken(token))?.id).toBe("c1");
  });
  it("una sesión revocada, vencida o de un cliente bloqueado no sirve", async () => {
    h.f.state.customer.push({ id: "c1", email: "ana@correo.co", name: "Ana", blockedAt: null });
    const token = await createCustomerSession("c1", req());
    h.f.state.customer[0].blockedAt = new Date();
    expect(await customerFromToken(token)).toBeNull();
    h.f.state.customer[0].blockedAt = null;
    h.f.state.customerSession[0].expiresAt = new Date(Date.now() - 1000);
    expect(await customerFromToken(token)).toBeNull();
    expect(await customerFromToken("token-inventado")).toBeNull();
  });
  it("las escrituras exigen sesión, mismo origen y, si se pide, correo verificado", async () => {
    h.f.state.customer.push({ id: "c1", email: "ana@correo.co", name: "Ana", emailVerifiedAt: null, blockedAt: null });
    const token = await createCustomerSession("c1", req());
    const cookie = `${CUSTOMER_COOKIE}=${token}`;
    expect("error" in (await requireCustomer(req("PATCH")))).toBe(true);
    const foreign = await requireCustomer(req("PATCH", { cookie, origin: "https://malicioso.example" }));
    expect(foreign.error?.status).toBe(403);
    const unverified = await requireCustomer(req("POST", { cookie, origin: "http://localhost:3000" }), { verified: true });
    expect(unverified.error?.status).toBe(403);
    const ok = await requireCustomer(req("GET", { cookie }));
    expect(ok.customer?.id).toBe("c1");
  });
});

describe("códigos de un solo uso", () => {
  it("el código de 6 dígitos sirve una sola vez y el anterior queda invalidado", async () => {
    const first = await issueToken("Ana@Correo.co", "otp");
    const second = await issueToken("ana@correo.co", "otp");
    expect(second).toMatch(/^\d{6}$/);
    expect(await consumeToken("ana@correo.co", "otp", first === second ? "000000x" : first)).toBe(false);
    expect(await consumeToken("ana@correo.co", "otp", second)).toBe(true);
    expect(await consumeToken("ana@correo.co", "otp", second)).toBe(false);
  });
  it(`se bloquea tras ${OTP_MAX_ATTEMPTS} intentos fallidos aunque luego llegue el correcto`, async () => {
    const code = await issueToken("ana@correo.co", "otp");
    const wrong = code === "123456" ? "654321" : "123456";
    for (let i = 0; i < OTP_MAX_ATTEMPTS; i++) await consumeToken("ana@correo.co", "otp", wrong);
    expect(await consumeToken("ana@correo.co", "otp", code)).toBe(false);
  });
  it("un código vencido no sirve", async () => {
    const code = await issueToken("ana@correo.co", "otp");
    h.f.state.customerToken.at(-1)!.expiresAt = new Date(Date.now() - 1);
    expect(await consumeToken("ana@correo.co", "otp", code)).toBe(false);
  });
});

describe("un solo perfil por correo", () => {
  it("Google y código por correo entran al mismo cliente", async () => {
    const a = await signInVerifiedEmail({ email: "ana@correo.co", name: "Ana", provider: "google", providerUserId: "g-1" });
    const b = await signInVerifiedEmail({ email: "ANA@correo.co", provider: "email_otp", providerUserId: "ana@correo.co" });
    expect(a.id).toBe(b.id);
    expect(h.f.state.customer).toHaveLength(1);
    expect(h.f.state.customerIdentity.map((i) => i.provider).sort()).toEqual(["email_otp", "google"]);
  });
  it("antitoma: si alguien registró el correo con contraseña sin verificarlo, el dueño real la anula", async () => {
    h.f.state.customer.push({ id: "c1", email: "ana@correo.co", name: "Intruso", emailVerifiedAt: null, passwordHash: "hash-del-intruso", blockedAt: null, avatarUrl: null });
    h.f.state.customerIdentity.push({ id: "i1", customerId: "c1", provider: "password", providerUserId: "ana@correo.co" });
    h.f.state.customerSession.push({ id: "s1", customerId: "c1", tokenHash: "x", revokedAt: null, expiresAt: new Date(Date.now() + 1e8) });
    const c = await signInVerifiedEmail({ email: "ana@correo.co", provider: "email_otp", providerUserId: "ana@correo.co" });
    expect(c.passwordHash).toBeNull();
    expect(c.emailVerifiedAt).toBeInstanceOf(Date);
    expect(h.f.state.customerSession[0].revokedAt).toBeInstanceOf(Date);
    expect(h.f.state.customerIdentity.some((i) => i.provider === "password")).toBe(false);
  });
  it("un cliente bloqueado no puede entrar", async () => {
    h.f.state.customer.push({ id: "c1", email: "ana@correo.co", name: "Ana", emailVerifiedAt: new Date(), blockedAt: new Date() });
    await expect(signInVerifiedEmail({ email: "ana@correo.co", provider: "google", providerUserId: "g-1" })).rejects.toMatchObject({ status: 403 });
  });
});

describe("redirección después de entrar", () => {
  it("solo acepta rutas internas", () => {
    expect(safeNext("/cuenta/pedidos/7H-K4M9QX")).toBe("/cuenta/pedidos/7H-K4M9QX");
    expect(safeNext("//evil.example")).toBe("/cuenta/pedidos");
    expect(safeNext("https://evil.example")).toBe("/cuenta/pedidos");
    expect(safeNext("/x\\@evil")).toBe("/cuenta/pedidos");
    expect(safeNext(undefined)).toBe("/cuenta/pedidos");
  });
});
