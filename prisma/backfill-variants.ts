/**
 * Crea las variantes (tallas) que falten en productos que tienen `sizes` pero aún no tienen inventario por talla.
 *
 * Por defecto cada talla nueva queda en stock 0 (NO se inventan existencias): después cuenta el
 * inventario físico y ajústalo en /admin/inventario.
 *
 * Solo si sabes que el stock global se puede repartir en partes iguales, usa --repartir
 * (el resto va a las primeras tallas). Es idempotente: omite productos que ya tienen variantes.
 *
 *   npx tsx prisma/backfill-variants.ts            ← tallas en 0 (recomendado)
 *   npx tsx prisma/backfill-variants.ts --repartir ← reparte el stock global
 */
import { PrismaClient } from "@prisma/client";
import { splitStock } from "../src/lib/sizes";

const prisma = new PrismaClient();
const split = process.argv.includes("--repartir");

async function main() {
  const products = await prisma.product.findMany({
    where: { sizes: { isEmpty: false } },
    include: { variants: true },
  });
  let converted = 0;
  for (const p of products) {
    if (p.variants.length > 0) continue;
    const shares = split ? splitStock(p.stock, p.sizes.length) : p.sizes.map(() => 0);
    await prisma.$transaction([
      ...p.sizes.map((size, i) => prisma.productVariant.create({ data: { productId: p.id, size, stock: shares[i] } })),
      prisma.product.update({ where: { id: p.id }, data: { stock: shares.reduce((n, x) => n + x, 0) } }),
    ]);
    converted++;
    console.log(`✔ ${p.slug}: ${p.sizes.map((s, i) => `${s}=${shares[i]}`).join(", ")}`);
  }
  console.log(`Listo. Productos convertidos: ${converted}.${split ? "" : " Ajusta el stock real de cada talla en /admin/inventario."}`);
}

main().finally(() => prisma.$disconnect());
