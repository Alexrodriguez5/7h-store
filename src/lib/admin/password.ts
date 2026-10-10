import { createHash, timingSafeEqual } from "node:crypto";

/** Comparación en tiempo constante (hashea ambos lados para igualar longitudes). */
export function safeEqual(a: string, b: string): boolean {
  const ha = createHash("sha256").update(a).digest();
  const hb = createHash("sha256").update(b).digest();
  return timingSafeEqual(ha, hb);
}

export function checkAdminPassword(candidate: string): boolean {
  const expected = process.env.ADMIN_PASSWORD;
  if (!expected) return false;
  return safeEqual(candidate, expected);
}

/** Límite de intentos en memoria (mejor esfuerzo; en serverless conviene un límite de infraestructura). */
const attempts = new Map<string, { count: number; resetAt: number }>();
const MAX_ATTEMPTS = 5;
const WINDOW_MS = 15 * 60 * 1000;

export function isRateLimited(key: string, now = Date.now()): boolean {
  const a = attempts.get(key);
  if (!a || a.resetAt < now) return false;
  return a.count >= MAX_ATTEMPTS;
}
export function registerFailure(key: string, now = Date.now()) {
  const a = attempts.get(key);
  if (!a || a.resetAt < now) attempts.set(key, { count: 1, resetAt: now + WINDOW_MS });
  else a.count += 1;
}
export function clearFailures(key: string) {
  attempts.delete(key);
}
