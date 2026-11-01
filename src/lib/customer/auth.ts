/**
 * Cuentas de clientes: un perfil por correo verificado con varias identidades (contraseña, Google, código OTP).
 * - Sesiones opacas: la cookie lleva un token aleatorio; en la base solo se guarda su SHA-256 (revocables).
 * - Los pedidos NO se vinculan por clave: se muestran los del correo VERIFICADO del cliente (incluye compras como invitado).
 * - Antitoma de cuenta: si alguien creó una cuenta con contraseña para un correo ajeno y el dueño real
 *   demuestra el correo (Google u OTP), se borra esa contraseña no verificada y se cierran sus sesiones.
 */
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { randomInt } from "node:crypto";
import type { Customer } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { randomToken, sha256Hex } from "@/lib/admin/password";
import { getClientIp, getUserAgent, isSameOrigin, readCookieValue } from "@/lib/request";

const IS_PROD = process.env.NODE_ENV === "production";
export const CUSTOMER_COOKIE = IS_PROD ? "__Host-7h_cliente" : "7h_cliente";
export const CUSTOMER_SESSION_DAYS = 30;

export const normalizeEmail = (e: string) => e.trim().toLowerCase();

export class CustomerAuthError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

// ── Sesiones ───────────────────────────────────────────────────────────

export async function createCustomerSession(customerId: string, req: Request) {
  const token = randomToken(32);
  await prisma.customerSession.create({
    data: { customerId, tokenHash: sha256Hex(token), expiresAt: new Date(Date.now() + CUSTOMER_SESSION_DAYS * 864e5), ip: getClientIp(req), userAgent: getUserAgent(req) },
  });
  return token;
}

type Jar = { cookies: { set: (name: string, value: string, opts: Record<string, unknown>) => unknown } };

/** SameSite=Lax: necesario para volver del inicio de sesión con Google. Las escrituras exigen además el mismo origen. */
export function setCustomerCookie(res: Jar, token: string) {
  res.cookies.set(CUSTOMER_COOKIE, token, { httpOnly: true, secure: IS_PROD, sameSite: "lax", path: "/", maxAge: CUSTOMER_SESSION_DAYS * 86400 });
}
export function clearCustomerCookie(res: Jar) {
  res.cookies.set(CUSTOMER_COOKIE, "", { httpOnly: true, secure: IS_PROD, sameSite: "lax", path: "/", maxAge: 0 });
}

export async function customerFromToken(token: string | undefined | null): Promise<Customer | null> {
  if (!token || token.length > 100) return null;
  const s = await prisma.customerSession.findUnique({ where: { tokenHash: sha256Hex(token) }, include: { customer: true } });
  if (!s || s.revokedAt || s.expiresAt < new Date() || s.customer.blockedAt) return null;
  return s.customer;
}

/** Cliente actual en páginas (una consulta por petición). */
export const getCurrentCustomer = cache(async () => customerFromToken((await cookies()).get(CUSTOMER_COOKIE)?.value));

/** Para páginas privadas: Next ejecuta la página a la vez que el layout, así que cada página valida la sesión por su cuenta. */
export async function requireCustomerPage(): Promise<Customer> {
  const c = await getCurrentCustomer();
  if (!c) redirect("/cuenta");
  return c;
}

const MUTATING = new Set(["POST", "PUT", "PATCH", "DELETE"]);

/** Para cada API privada del cliente: sesión válida + mismo origen en escrituras. */
export async function requireCustomer(req: Request, opts: { verified?: boolean } = {}) {
  const customer = await customerFromToken(readCookieValue(req, CUSTOMER_COOKIE));
  if (!customer) return { error: NextResponse.json({ error: "Inicia sesión para continuar." }, { status: 401 }) } as const;
  if (MUTATING.has(req.method) && !isSameOrigin(req)) return { error: NextResponse.json({ error: "Origen no permitido" }, { status: 403 }) } as const;
  if (opts.verified && !customer.emailVerifiedAt) return { error: NextResponse.json({ error: "Primero verifica tu correo." }, { status: 403 }) } as const;
  return { customer } as const;
}

export async function revokeCustomerSessions(customerId: string, exceptTokenHash?: string) {
  await prisma.customerSession.updateMany({ where: { customerId, revokedAt: null, ...(exceptTokenHash ? { tokenHash: { not: exceptTokenHash } } : {}) }, data: { revokedAt: new Date() } });
}

// ── Códigos y enlaces de un solo uso ──────────────────────────────────

export type TokenPurpose = "verify" | "reset" | "otp";
const TTL_MIN: Record<TokenPurpose, number> = { verify: 24 * 60, reset: 30, otp: 10 };
export const OTP_MAX_ATTEMPTS = 5;

/** Crea un código (OTP de 6 dígitos) o enlace (token largo). Invalida los anteriores del mismo tipo. */
export async function issueToken(email: string, purpose: TokenPurpose) {
  const e = normalizeEmail(email);
  const raw = purpose === "otp" ? String(randomInt(0, 1_000_000)).padStart(6, "0") : randomToken(32);
  await prisma.$transaction([
    prisma.customerToken.updateMany({ where: { email: e, purpose, usedAt: null }, data: { usedAt: new Date() } }),
    prisma.customerToken.create({ data: { email: e, purpose, tokenHash: sha256Hex(`${purpose}:${e}:${raw}`), expiresAt: new Date(Date.now() + TTL_MIN[purpose] * 60_000) } }),
  ]);
  return raw;
}

/** Valida y consume un código/enlace. Los OTP se bloquean tras 5 intentos fallidos. */
export async function consumeToken(email: string, purpose: TokenPurpose, raw: string): Promise<boolean> {
  const e = normalizeEmail(email);
  const t = await prisma.customerToken.findFirst({ where: { email: e, purpose, usedAt: null }, orderBy: { createdAt: "desc" } });
  if (!t || t.expiresAt < new Date() || t.attempts >= OTP_MAX_ATTEMPTS) return false;
  if (t.tokenHash !== sha256Hex(`${purpose}:${e}:${raw.trim()}`)) {
    await prisma.customerToken.update({ where: { id: t.id }, data: { attempts: { increment: 1 } } });
    return false;
  }
  const ok = await prisma.customerToken.updateMany({ where: { id: t.id, usedAt: null }, data: { usedAt: new Date() } });
  return ok.count === 1;
}

// ── Perfil único por correo ───────────────────────────────────────────

/**
 * Inicio de sesión con un correo YA DEMOSTRADO (Google con email_verified u OTP):
 * crea el cliente si no existe, lo marca verificado y vincula la identidad.
 */
export async function signInVerifiedEmail(input: { email: string; name?: string | null; avatarUrl?: string | null; provider: "google" | "email_otp"; providerUserId: string }) {
  const email = normalizeEmail(input.email);
  const existing = await prisma.customer.findUnique({ where: { email } });
  if (existing?.blockedAt) throw new CustomerAuthError(403, "Esta cuenta está bloqueada. Escríbenos para ayudarte.");
  let customer: Customer;
  if (!existing) {
    customer = await prisma.customer.create({ data: { email, emailVerifiedAt: new Date(), name: (input.name ?? "").trim().slice(0, 120) || email.split("@")[0], avatarUrl: input.avatarUrl ?? null } });
  } else if (!existing.emailVerifiedAt) {
    // Cuenta creada con contraseña pero nunca verificada: el dueño real del correo la reclama.
    customer = await prisma.customer.update({ where: { id: existing.id }, data: { emailVerifiedAt: new Date(), passwordHash: null, ...(input.avatarUrl && !existing.avatarUrl ? { avatarUrl: input.avatarUrl } : {}) } });
    await revokeCustomerSessions(existing.id);
    await prisma.customerIdentity.deleteMany({ where: { customerId: existing.id, provider: "password" } });
  } else {
    customer = existing.avatarUrl || !input.avatarUrl ? existing : await prisma.customer.update({ where: { id: existing.id }, data: { avatarUrl: input.avatarUrl } });
  }
  await prisma.customerIdentity.upsert({
    where: { provider_providerUserId: { provider: input.provider, providerUserId: input.providerUserId } },
    update: {},
    create: { customerId: customer.id, provider: input.provider, providerUserId: input.providerUserId },
  });
  return customer;
}
