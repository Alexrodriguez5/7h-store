/**
 * Respaldo externo de la base de datos (solo LECTURA). Exporta cada modelo de Prisma a JSON y escribe un
 * manifiesto con el número de filas y el SHA-256 de cada archivo. Después verifica el respaldo:
 * recalcula los hashes y compara los conteos con la base en vivo.
 *
 *   npx tsx scripts/respaldo/exportar-base.ts <carpeta-destino>
 *   npx tsx scripts/respaldo/exportar-base.ts --verificar <carpeta-del-respaldo>
 *
 * La carpeta destino debe estar FUERA del repositorio: el respaldo contiene datos personales.
 * No imprime filas ni secretos; solo nombres de tablas, conteos y hashes.
 */
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { loadEnvConfig } from "@next/env";

loadEnvConfig(process.cwd());

const sha = (b: Buffer | string) => createHash("sha256").update(b).digest("hex");
const replacer = (_k: string, v: unknown) =>
  typeof v === "bigint" ? { $bigint: v.toString() } : v instanceof Uint8Array ? { $bytes: Buffer.from(v).toString("base64") } : v;

async function main() {
  const { Prisma, PrismaClient } = await import("@prisma/client");
  const db = new PrismaClient();
  const models = Prisma.dmmf.datamodel.models.map((m) => m.name);
  const delegate = (name: string) => (db as unknown as Record<string, { findMany: (a?: unknown) => Promise<unknown[]>; count: () => Promise<number> }>)[name[0].toLowerCase() + name.slice(1)];

  const verify = process.argv[2] === "--verificar";
  const dir = resolve(process.argv[verify ? 3 : 2] ?? "");
  if (!process.argv[verify ? 3 : 2]) throw new Error("Indica la carpeta destino (fuera del repositorio).");
  if (dir.startsWith(resolve(process.cwd()))) throw new Error("La carpeta debe estar fuera del repositorio.");

  if (!verify) {
    mkdirSync(dir, { recursive: true });
    const host = (process.env.DATABASE_URL ?? "").match(/@([^:/]+)/)?.[1] ?? "?";
    const manifest: { creado: string; host: string; tablas: Record<string, { filas: number; sha256: string }> } = { creado: new Date().toISOString(), host, tablas: {} };
    for (const m of models) {
      const rows = await delegate(m).findMany();
      const body = JSON.stringify(rows, replacer);
      writeFileSync(join(dir, `${m}.json`), body);
      manifest.tablas[m] = { filas: rows.length, sha256: sha(body) };
    }
    writeFileSync(join(dir, "MANIFIESTO.json"), JSON.stringify(manifest, null, 2));
    console.log(`Exportadas ${models.length} tablas a ${dir}`);
  }

  // Verificación: hashes de los archivos y conteos contra la base en vivo.
  const manifest = JSON.parse(readFileSync(join(dir, "MANIFIESTO.json"), "utf8")) as { tablas: Record<string, { filas: number; sha256: string }> };
  let ok = true;
  let total = 0;
  for (const [m, info] of Object.entries(manifest.tablas)) {
    const body = readFileSync(join(dir, `${m}.json`));
    const rows = JSON.parse(body.toString()) as unknown[];
    const live = await delegate(m).count();
    const good = sha(body) === info.sha256 && rows.length === info.filas && live === info.filas;
    total += info.filas;
    if (!good) { ok = false; console.log(`DIFERENCIA ${m}: archivo=${rows.length} manifiesto=${info.filas} base=${live}`); }
  }
  console.log(JSON.stringify({ verificado: ok, tablas: Object.keys(manifest.tablas).length, filas: total, manifiesto_sha256: sha(readFileSync(join(dir, "MANIFIESTO.json"))) }));
  await db.$disconnect();
  if (!ok) process.exit(2);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message.slice(0, 300) : e);
  process.exit(1);
});
