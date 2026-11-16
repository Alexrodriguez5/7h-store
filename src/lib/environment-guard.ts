import { createHash } from "node:crypto";

/**
 * Aislamiento de entornos: un despliegue que NO es producción (Preview o desarrollo en Vercel) nunca debe
 * conectarse a la base de datos ni al almacenamiento de producción. Si por error las variables de Preview
 * apuntan a producción, la app falla al arrancar en lugar de escribir datos reales.
 *
 * El identificador del proyecto de producción se guarda como hash (SHA-256): el repositorio es público.
 */
const PRODUCTION_REF_HASHES = new Set(["c18a23982aba9e9e61a8ee9e4f2dc336cadf4b5fca0d82aaa4215651aed70421"]);

const hash = (s: string) => createHash("sha256").update(s).digest("hex");

/** Referencias de proyecto de Supabase presentes en una URL de base de datos o de la API. */
export function supabaseRefs(raw: string | undefined): string[] {
  if (!raw) return [];
  const refs = new Set<string>();
  for (const m of raw.matchAll(/(?:postgres\.|db\.|\/\/)([a-z0-9]{20})(?=[.:@/]|$)/g)) refs.add(m[1]);
  return [...refs];
}

/** `env.PRODUCTION_SUPABASE_REF_SHA256` (lista separada por comas) agrega otros proyectos de producción. */
export function isProductionResource(raw: string | undefined, env: Record<string, string | undefined> = process.env) {
  const extra = (env.PRODUCTION_SUPABASE_REF_SHA256 ?? "").split(",").map((x) => x.trim()).filter(Boolean);
  return supabaseRefs(raw).some((r) => PRODUCTION_REF_HASHES.has(hash(r)) || extra.includes(hash(r)));
}

/** true en despliegues de Vercel que no son producción (Preview y desarrollo). */
export const isNonProductionDeployment = (env: Record<string, string | undefined> = process.env) => Boolean(env.VERCEL) && env.VERCEL_ENV !== "production";

export class EnvironmentIsolationError extends Error {
  constructor(what: string) {
    super(`Aislamiento de entornos: este despliegue no es de producción y ${what} apunta a producción. Configura las variables de Preview con los recursos de pruebas.`);
  }
}

/** Lanza si un despliegue que no es de producción usa un recurso de producción. */
export function assertIsolated(what: string, raw: string | undefined, env: Record<string, string | undefined> = process.env) {
  if (isNonProductionDeployment(env) && isProductionResource(raw, env)) throw new EnvironmentIsolationError(what);
}
