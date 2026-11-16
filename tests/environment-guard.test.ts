import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { assertIsolated, isProductionResource, supabaseRefs } from "@/lib/environment-guard";
import { runtimeDatabaseUrl } from "@/lib/db-url";

// Referencias ficticias: la real de producción solo vive como hash en environment-guard.ts.
const PROD = "prodprodprodprodprod";
const TEST = "testtesttesttesttest";
const marker = { PRODUCTION_SUPABASE_REF_SHA256: createHash("sha256").update(PROD).digest("hex") };
const dbUrl = (ref: string) => `postgresql://postgres.${ref}:x@aws-0-ca-central-1.pooler.supabase.com:5432/postgres`;

describe("aislamiento de entornos", () => {
  it("reconoce la referencia del proyecto en URLs de base y de API", () => {
    expect(supabaseRefs(dbUrl(PROD))).toEqual([PROD]);
    expect(supabaseRefs(`https://${PROD}.supabase.co`)).toEqual([PROD]);
    expect(supabaseRefs(`postgresql://postgres:x@db.${PROD}.supabase.co:5432/postgres`)).toEqual([PROD]);
    expect(isProductionResource(dbUrl(PROD), marker)).toBe(true);
    expect(isProductionResource(dbUrl(TEST), marker)).toBe(false);
  });

  it("Preview con la base de producción falla al arrancar", () => {
    const preview = { VERCEL: "1", VERCEL_ENV: "preview", ...marker };
    expect(() => runtimeDatabaseUrl(dbUrl(PROD), preview)).toThrow(/Aislamiento/);
    expect(() => assertIsolated("SUPABASE_URL", `https://${PROD}.supabase.co`, preview)).toThrow();
    expect(runtimeDatabaseUrl(dbUrl(TEST), preview)).toContain(TEST);
  });

  it("producción y desarrollo local no se bloquean", () => {
    expect(() => runtimeDatabaseUrl(dbUrl(PROD), { VERCEL: "1", VERCEL_ENV: "production", ...marker })).not.toThrow();
    expect(() => runtimeDatabaseUrl(dbUrl(PROD), { ...marker })).not.toThrow();
  });
});

describe("excepción explícita para validar en Preview", () => {
  it("solo con ALLOW_PRODUCTION_DATA_IN_PREVIEW=1", () => {
    const preview = { VERCEL: "1", VERCEL_ENV: "preview", ...marker };
    expect(() => runtimeDatabaseUrl(dbUrl(PROD), { ...preview, ALLOW_PRODUCTION_DATA_IN_PREVIEW: "1" })).not.toThrow();
    expect(() => runtimeDatabaseUrl(dbUrl(PROD), { ...preview, ALLOW_PRODUCTION_DATA_IN_PREVIEW: "true" })).toThrow();
  });
});
