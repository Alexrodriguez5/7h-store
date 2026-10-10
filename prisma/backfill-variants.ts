/**
 * Convierte productos con `sizes` (stock global) en variantes por talla.
 * Reparte el stock actual en partes iguales (el resto va a las primeras tallas).
 * Es idempotente: omite productos que ya tienen variantes.
 * Revisa los resultados en /admin/inventario.
 *
 *   npx tsx prisma/backfill-variants.ts
 */
import { PrismaClient } from "@prisma/client";
import { splitStock } from "../src/lib/sizes";

const prisma = new PrismaClient();

async function main() {
  const products = await prisma.product.findMany({
    where: { sizes: { isEmpty: false } },
    include: { variants: true },
  });
  let converted = 0;
  for (const p of products) {
    if (p.variants.length > 0) continue;
    const shares = splitStock(p.stock, p.sizes.length);
    await prisma.$transaction([
      ...p.sizes.map((size, i) =>
        prisma.productVariant.create({ data: { productId: p.id, size, stock: shares[i] } })
      ),
    ]);
    converted++;
    console.log(`✔ ${p.slug}: ${p.sizes.map((s, i) => `${s}=${shares[i]}`).join(", ")}`);
  }
  console.log(`Listo. Productos convertidos: ${converted}.`);
}

main().finally(() => prisma.$disconnect());
