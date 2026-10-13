import { createHash } from "node:crypto";
import type { PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/prisma";

/**
 * Límite de intentos PERSISTENTE (tabla RateLimit en PostgreSQL), válido aunque la app
 * corra en varias instancias serverless. El incremento es atómico (INSERT … ON CONFLICT).
 */
export interface RateStore {
  hit(key: string, windowMs: number, now: number): Promise<{ count: number; resetAt: Date }>;
  peek(key: string, now: number): Promise<{ count: number; resetAt: Date } | null>;
  reset(key: string): Promise<void>;
}

export class PrismaRateStore implements RateStore {
  constructor(private db: PrismaClient = prisma) {}
  async hit(key: string, windowMs: number, now: number) {
    const nowDate = new Date(now);
    const reset = new Date(now + windowMs);
    const rows = await this.db.$queryRaw<{ count: number; resetAt: Date }[]>`
      INSERT INTO "RateLimit" ("key", "count", "resetAt") VALUES (${key}, 1, ${reset})
      ON CONFLICT ("key") DO UPDATE SET
        "count"   = CASE WHEN "RateLimit"."resetAt" <= ${nowDate} THEN 1 ELSE "RateLimit"."count" + 1 END,
        "resetAt" = CASE WHEN "RateLimit"."resetAt" <= ${nowDate} THEN ${reset} ELSE "RateLimit"."resetAt" END
      RETURNING "count", "resetAt"`;
    return { count: Number(rows[0].count), resetAt: new Date(rows[0].resetAt) };
  }
  async peek(key: string, now: number) {
    const r = await this.db.rateLimit.findUnique({ where: { key } });
    return r && r.resetAt.getTime() > now ? { count: r.count, resetAt: r.resetAt } : null;
  }
  async reset(key: string) {
    await this.db.rateLimit.deleteMany({ where: { key } });
  }
}

/** Solo para pruebas. */
export class MemoryRateStore implements RateStore {
  private m = new Map<string, { count: number; resetAt: Date }>();
  async hit(key: string, windowMs: number, now: number) {
    const cur = this.m.get(key);
    const next = !cur || cur.resetAt.getTime() <= now ? { count: 1, resetAt: new Date(now + windowMs) } : { count: cur.count + 1, resetAt: cur.resetAt };
    this.m.set(key, next);
    return { ...next };
  }
  async peek(key: string, now: number) {
    const cur = this.m.get(key);
    return cur && cur.resetAt.getTime() > now ? { ...cur } : null;
  }
  async reset(key: string) { this.m.delete(key); }
}

let store: RateStore | undefined;
export const rateStore = (): RateStore => (store ??= new PrismaRateStore());
/** Permite inyectar un almacén en pruebas. */
export const setRateStore = (s: RateStore | undefined) => { store = s; };

export interface LimitResult { allowed: boolean; retryAfterSec: number }

/**
 * Cuenta una petición y dice si está dentro del límite.
 * Si la base de datos falla, NO bloquea la tienda (fail-open) pero lo registra en el log.
 */
export async function consume(key: string, limit: number, windowMs: number, now = Date.now()): Promise<LimitResult> {
  try {
    const r = await rateStore().hit(key, windowMs, now);
    return { allowed: r.count <= limit, retryAfterSec: Math.max(1, Math.ceil((r.resetAt.getTime() - now) / 1000)) };
  } catch (e) {
    console.error("[rate-limit] no disponible:", e instanceof Error ? e.message : e);
    return { allowed: true, retryAfterSec: 0 };
  }
}

/** Consulta sin contar (para bloquear ANTES de verificar una contraseña). */
export async function isBlocked(key: string, limit: number, now = Date.now()): Promise<boolean> {
  try {
    const r = await rateStore().peek(key, now);
    return !!r && r.count >= limit;
  } catch (e) {
    console.error("[rate-limit] no disponible:", e instanceof Error ? e.message : e);
    return false;
  }
}

export async function registerHit(key: string, windowMs: number, now = Date.now()): Promise<void> {
  try { await rateStore().hit(key, windowMs, now); } catch (e) { console.error("[rate-limit] no disponible:", e instanceof Error ? e.message : e); }
}

export async function clearLimit(key: string): Promise<void> {
  try { await rateStore().reset(key); } catch { /* sin efecto */ }
}

export const MIN = 60_000;

export function tooMany(retryAfterSec: number, message = "Demasiados intentos. Espera unos minutos e inténtalo de nuevo.") {
  return Response.json({ error: message }, { status: 429, headers: { "Retry-After": String(retryAfterSec) } });
}

/** Para claves que contienen datos personales (correos): se guarda un hash, no el dato. */
export const hashedKey = (prefix: string, value: string) => `${prefix}:${createHash("sha256").update(value).digest("hex").slice(0, 32)}`;
