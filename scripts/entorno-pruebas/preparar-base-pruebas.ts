/**
 * Prepara la base de PRUEBAS para Vercel Preview (solo se escribe en la base de pruebas).
 *
 *   npx prisma migrate deploy   (con DATABASE_URL de .env.staging)  → esquema
 *   npx tsx scripts/entorno-pruebas/preparar-base-pruebas.ts         → datos
 *
 * Copia desde producción (solo LECTURA) lo que no tiene datos personales: categorías, productos, variantes,
 * zonas de envío y la biblioteca aprobada de AURA. Crea un administrador de prueba con una contraseña
 * aleatoria que se guarda SOLO en .env.staging (ignorado por Git). No copia pedidos, clientes ni mensajes.
 *
 * Se niega a escribir si la base de destino es la de producción.
 */
import { randomBytes } from "node:crypto";
import { appendFileSync, readFileSync } from "node:fs";
import { parse } from "dotenv";
import { loadEnvConfig } from "@next/env";

loadEnvConfig(process.cwd());

async function main() {
  const staging = parse(readFileSync(".env.staging"));
  if (!staging.DATABASE_URL) throw new Error("Falta DATABASE_URL en .env.staging");
  const { isProductionResource } = await import("@/lib/environment-guard");
  if (isProductionResource(staging.DATABASE_URL)) throw new Error("La base de .env.staging es la de PRODUCCIÓN. No se escribe nada.");
  if (!isProductionResource(process.env.DATABASE_URL)) throw new Error("La base de origen (.env.local) no es producción: no hay nada que copiar.");

  const { PrismaClient } = await import("@prisma/client");
  const prod = new PrismaClient({ datasources: { db: { url: process.env.DATABASE_URL } } });
  const test = new PrismaClient({ datasources: { db: { url: staging.DATABASE_URL } } });

  const copy = async <T extends { id: string }>(name: string, rows: T[], create: (r: T) => Promise<unknown>) => {
    let n = 0;
    for (const r of rows) { await create(r); n++; }
    console.log(`${name}: ${n}`);
  };

  const t = test as unknown as Record<string, { upsert: (a: unknown) => Promise<unknown> }>;
  const up = (model: string) => (r: { id: string }) => t[model].upsert({ where: { id: r.id }, create: r, update: r });

  await copy("Category", await prod.category.findMany(), up("category"));
  await copy("Product", await prod.product.findMany(), up("product"));
  await copy("ProductVariant", await prod.productVariant.findMany(), up("productVariant"));
  await copy("ShippingZone", await prod.shippingZone.findMany(), up("shippingZone"));
  const entries = await prod.knowledgeEntry.findMany({ where: { status: "aprobada" } });
  await copy("KnowledgeEntry", entries.map((e) => ({ ...e, approvedById: null, duplicateOfId: null, conflictWithId: null })), up("knowledgeEntry"));
  await copy("KnowledgeQuestion", await prod.knowledgeQuestion.findMany({ where: { entryId: { in: entries.map((e) => e.id) } } }), up("knowledgeQuestion"));

  if ((await test.adminUser.count()) === 0) {
    const { createFirstOwner } = await import("@/lib/admin/auth");
    const email = "admin.pruebas@7hstore.app";
    const password = `Pr-${randomBytes(12).toString("base64url")}-7h`;
    await createFirstOwner({ name: "Administrador de pruebas", email, password }, test);
    appendFileSync(".env.staging", `\n# Administrador de la base de PRUEBAS (solo Preview)\nPREVIEW_ADMIN_EMAIL=${email}\nPREVIEW_ADMIN_PASSWORD=${password}\n`);
    console.log("Administrador de prueba creado; credenciales guardadas en .env.staging");
  }
  await prod.$disconnect();
  await test.$disconnect();
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message.slice(0, 400) : e);
  process.exit(1);
});
