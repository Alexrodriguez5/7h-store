import type { AdminRole, PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { SESSION_MAX_AGE, createSessionToken, verifySessionToken } from "./session";
import { dummyHash, hashPassword, passwordPolicyError, randomToken, sha256Hex, verifyPassword } from "./password";

export class AuthError extends Error {
  constructor(public status: 400 | 401 | 403 | 404 | 409 | 503, message: string) { super(message); }
}

export interface SessionAdmin { id: string; email: string; name: string; role: AdminRole; sessionId: string }

export const normalizeEmail = (e: string) => e.trim().toLowerCase();

/** Verifica credenciales. Siempre ejecuta scrypt (aunque el correo no exista) para no revelar cuentas por tiempo. */
export async function authenticate(email: string, password: string, db: PrismaClient = prisma) {
  const user = await db.adminUser.findUnique({ where: { email: normalizeEmail(email) } });
  const ok = await verifyPassword(password, user?.passwordHash ?? (await dummyHash()));
  return user && user.active && ok ? user : null;
}

export async function createSession(adminId: string, meta: { ip?: string | null; userAgent?: string | null }, db: PrismaClient = prisma, now = Date.now()) {
  const token = await createSessionToken(now);
  await db.adminSession.create({
    data: { adminId, tokenHash: sha256Hex(token), expiresAt: new Date(now + SESSION_MAX_AGE * 1000), ip: meta.ip ?? null, userAgent: meta.userAgent ?? null },
  });
  await db.adminUser.update({ where: { id: adminId }, data: { lastLoginAt: new Date(now) } });
  return token;
}

/**
 * Resuelve la sesión: firma válida + registro en BD no revocado ni vencido + cuenta activa
 * + sesión posterior al último cambio de contraseña.
 */
export async function getSessionAdmin(token: string | undefined | null, db: PrismaClient = prisma, now = Date.now()): Promise<SessionAdmin | null> {
  if (!token || !(await verifySessionToken(token, now))) return null;
  const s = await db.adminSession.findUnique({
    where: { tokenHash: sha256Hex(token) },
    select: { id: true, revokedAt: true, expiresAt: true, createdAt: true, admin: { select: { id: true, email: true, name: true, role: true, active: true, passwordChangedAt: true } } },
  });
  if (!s || s.revokedAt || s.expiresAt.getTime() <= now || !s.admin.active) return null;
  if (s.admin.passwordChangedAt.getTime() > s.createdAt.getTime()) return null;
  return { id: s.admin.id, email: s.admin.email, name: s.admin.name, role: s.admin.role, sessionId: s.id };
}

export async function revokeSession(sessionId: string, db: PrismaClient = prisma) {
  await db.adminSession.updateMany({ where: { id: sessionId, revokedAt: null }, data: { revokedAt: new Date() } });
}

export async function revokeAllSessions(adminId: string, db: PrismaClient = prisma) {
  const r = await db.adminSession.updateMany({ where: { adminId, revokedAt: null }, data: { revokedAt: new Date() } });
  return r.count;
}

export const countAdmins = (db: PrismaClient = prisma) => db.adminUser.count();

/** Crea el PRIMER administrador (OWNER). Falla si ya existe alguno. */
export async function createFirstOwner(input: { name: string; email: string; password: string }, db: PrismaClient = prisma) {
  const policy = passwordPolicyError(input.password, input.email);
  if (policy) throw new AuthError(400, policy);
  const passwordHash = await hashPassword(input.password);
  return db.$transaction(async (tx) => {
    if ((await tx.adminUser.count()) > 0) throw new AuthError(409, "La configuración inicial ya se completó. Inicia sesión.");
    return tx.adminUser.create({ data: { name: input.name.trim(), email: normalizeEmail(input.email), passwordHash, role: "OWNER" } });
  });
}

/** Un OWNER crea otra cuenta administrativa (no existe registro público). */
export async function createAdmin(input: { name: string; email: string; password: string; role: AdminRole }, db: PrismaClient = prisma) {
  const policy = passwordPolicyError(input.password, input.email);
  if (policy) throw new AuthError(400, policy);
  const email = normalizeEmail(input.email);
  if (await db.adminUser.findUnique({ where: { email }, select: { id: true } })) throw new AuthError(409, "Ya existe un administrador con ese correo.");
  return db.adminUser.create({ data: { name: input.name.trim(), email, passwordHash: await hashPassword(input.password), role: input.role }, select: { id: true, email: true, role: true } });
}

/** Cambia la contraseña e invalida TODAS las sesiones de esa cuenta. */
export async function setPassword(adminId: string, newPassword: string, db: PrismaClient = prisma) {
  const admin = await db.adminUser.findUnique({ where: { id: adminId }, select: { email: true } });
  if (!admin) throw new AuthError(404, "Administrador no encontrado.");
  const policy = passwordPolicyError(newPassword, admin.email);
  if (policy) throw new AuthError(400, policy);
  const passwordHash = await hashPassword(newPassword);
  await db.$transaction(async (tx) => {
    await tx.adminUser.update({ where: { id: adminId }, data: { passwordHash, passwordChangedAt: new Date() } });
    await tx.adminSession.updateMany({ where: { adminId, revokedAt: null }, data: { revokedAt: new Date() } });
    await tx.adminPasswordReset.updateMany({ where: { adminId, usedAt: null }, data: { usedAt: new Date() } });
  });
}

/** Evita dejar la tienda sin ningún OWNER activo. */
async function assertNotLastOwner(targetId: string, db: PrismaClient) {
  const target = await db.adminUser.findUnique({ where: { id: targetId }, select: { role: true, active: true } });
  if (!target) throw new AuthError(404, "Administrador no encontrado.");
  if (target.role === "OWNER" && target.active) {
    const owners = await db.adminUser.count({ where: { role: "OWNER", active: true } });
    if (owners <= 1) throw new AuthError(409, "No puedes dejar la tienda sin un dueño activo.");
  }
}

export async function setAdminActive(actorId: string, targetId: string, active: boolean, db: PrismaClient = prisma) {
  if (actorId === targetId) throw new AuthError(409, "No puedes desactivar tu propia cuenta.");
  if (!active) await assertNotLastOwner(targetId, db);
  const r = await db.adminUser.updateMany({ where: { id: targetId }, data: { active } });
  if (r.count !== 1) throw new AuthError(404, "Administrador no encontrado.");
  if (!active) await revokeAllSessions(targetId, db);
}

export async function setAdminRole(actorId: string, targetId: string, role: AdminRole, db: PrismaClient = prisma) {
  if (actorId === targetId) throw new AuthError(409, "No puedes cambiar tu propio rol.");
  if (role !== "OWNER") await assertNotLastOwner(targetId, db);
  const r = await db.adminUser.updateMany({ where: { id: targetId }, data: { role } });
  if (r.count !== 1) throw new AuthError(404, "Administrador no encontrado.");
}

// ---------- Recuperación de contraseña ----------

export const RESET_TTL_MS = 30 * 60 * 1000;

/**
 * Crea un token de un solo uso (se guarda SOLO su hash) e invalida los anteriores.
 * Devuelve null si la cuenta no existe o está inactiva (quien llama responde siempre lo mismo).
 */
export async function createPasswordReset(email: string, db: PrismaClient = prisma, now = Date.now()) {
  const admin = await db.adminUser.findUnique({ where: { email: normalizeEmail(email) }, select: { id: true, email: true, name: true, active: true } });
  if (!admin || !admin.active) return null;
  const token = randomToken(32);
  await db.$transaction(async (tx) => {
    await tx.adminPasswordReset.updateMany({ where: { adminId: admin.id, usedAt: null }, data: { usedAt: new Date(now) } });
    await tx.adminPasswordReset.create({ data: { adminId: admin.id, tokenHash: sha256Hex(token), expiresAt: new Date(now + RESET_TTL_MS) } });
  });
  return { token, admin };
}

/** Consume el token (una sola vez), cambia la contraseña y cierra todas las sesiones. */
export async function resetPasswordWithToken(token: string, newPassword: string, db: PrismaClient = prisma, now = Date.now()) {
  const invalid = new AuthError(400, "El enlace no es válido o ya expiró. Solicita uno nuevo.");
  if (!token || token.length < 20 || token.length > 200) throw invalid;
  const row = await db.adminPasswordReset.findUnique({ where: { tokenHash: sha256Hex(token) }, include: { admin: { select: { id: true, email: true, active: true } } } });
  if (!row || row.usedAt || row.expiresAt.getTime() <= now || !row.admin.active) throw invalid;
  const policy = passwordPolicyError(newPassword, row.admin.email);
  if (policy) throw new AuthError(400, policy);
  const passwordHash = await hashPassword(newPassword);
  await db.$transaction(async (tx) => {
    // Candado de un solo uso: si otra petición lo usó primero, esta no hace nada.
    const claimed = await tx.adminPasswordReset.updateMany({ where: { id: row.id, usedAt: null }, data: { usedAt: new Date(now) } });
    if (claimed.count !== 1) throw invalid;
    await tx.adminUser.update({ where: { id: row.adminId }, data: { passwordHash, passwordChangedAt: new Date(now) } });
    await tx.adminSession.updateMany({ where: { adminId: row.adminId, revokedAt: null }, data: { revokedAt: new Date(now) } });
    await tx.adminPasswordReset.updateMany({ where: { adminId: row.adminId, usedAt: null }, data: { usedAt: new Date(now) } });
  });
  return row.admin;
}
