import { PrismaClient, Gender } from "@prisma/client";

const prisma = new PrismaClient();

const img = (id: string) =>
  `https://images.unsplash.com/${id}?auto=format&fit=crop&w=900&q=82`;

const categories = [
  ["tecnologia", "Tecnología"],
  ["ropa", "Ropa"],
  ["calzado", "Calzado"],
  ["accesorios", "Accesorios"],
] as const;

const products = [
  [
    "sony-wh1000xm5",
    "Audífonos WH-1000XM5",
    "Sony",
    1390000,
    1590000,
    "tecnologia",
    "UNISEX",
    false,
    12,
    ["audio", "bluetooth", "sony"],
    true,
    "photo-1505740420928-5e560c06d30e",
  ],
  [
    "apple-airpods-pro-2",
    "AirPods Pro 2",
    "Apple",
    980000,
    1090000,
    "tecnologia",
    "UNISEX",
    true,
    16,
    ["apple", "audio", "airpods"],
    true,
    "photo-1606220945770-b5b6c2c55bf1",
  ],
  [
    "kindle-paperwhite",
    "Kindle Paperwhite",
    "Amazon",
    720000,
    null,
    "tecnologia",
    "UNISEX",
    false,
    10,
    ["lectura", "kindle"],
    true,
    "photo-1544947950-fa07a98d237f",
  ],
  [
    "levi-501",
    "Jean 501 Original",
    "Levi's",
    329000,
    389000,
    "ropa",
    "HOMBRE",
    false,
    20,
    ["jean", "denim"],
    true,
    "photo-1542272604-787c3835535d",
  ],
  [
    "hoodie-essential",
    "Hoodie Essential",
    "Champion",
    289000,
    null,
    "ropa",
    "UNISEX",
    false,
    14,
    ["hoodie", "casual"],
    false,
    "photo-1556821840-3a63f95609a7",
  ],
  [
    "camisa-oxford",
    "Camisa Oxford",
    "Ralph Lauren",
    449000,
    499000,
    "ropa",
    "MUJER",
    false,
    9,
    ["camisa", "oxford"],
    false,
    "photo-1596755389378-c31d21fd1273",
  ],
  [
    "adidas-stan-smith",
    "Stan Smith",
    "Adidas",
    479000,
    529000,
    "calzado",
    "UNISEX",
    false,
    18,
    ["tenis", "adidas"],
    true,
    "photo-1542291026-7eec264c27ff",
  ],
  [
    "nike-air-force",
    "Air Force 1",
    "Nike",
    539000,
    null,
    "calzado",
    "MUJER",
    false,
    11,
    ["nike", "tenis"],
    true,
    "photo-1549298916-b41d501d3772",
  ],
  [
    "timberland-boot",
    "Botín 6-Inch Premium",
    "Timberland",
    699000,
    799000,
    "calzado",
    "HOMBRE",
    false,
    7,
    ["botas", "timberland"],
    false,
    "photo-1520639888713-7851133b1ed0",
  ],
  [
    "fossil-watch",
    "Reloj Neutra",
    "Fossil",
    649000,
    749000,
    "accesorios",
    "UNISEX",
    true,
    8,
    ["reloj", "acero"],
    true,
    "photo-1524805444758-089113d48a6d",
  ],
  [
    "herschel-backpack",
    "Mochila Classic",
    "Herschel",
    319000,
    null,
    "accesorios",
    "UNISEX",
    true,
    13,
    ["mochila", "bolso"],
    true,
    "photo-1553062407-98eeb64c6a62",
  ],
  [
    "rayban-aviator",
    "Aviator Classic",
    "Ray-Ban",
    579000,
    649000,
    "accesorios",
    "UNISEX",
    true,
    6,
    ["gafas", "rayban"],
    false,
    "photo-1511499767150-a48a237f0083",
  ],
  [
    "coach-crossbody",
    "Bolso Crossbody",
    "Coach",
    899000,
    999000,
    "accesorios",
    "MUJER",
    true,
    5,
    ["bolso", "coach"],
    true,
    "photo-1584917865442-de89df76afd3",
  ],
  [
    "new-balance-574",
    "574 Core",
    "New Balance",
    499000,
    null,
    "calzado",
    "UNISEX",
    false,
    15,
    ["tenis", "running"],
    false,
    "photo-1552346154-21d32810aba3",
  ],
  [
    "carhartt-jacket",
    "Chaqueta Detroit",
    "Carhartt",
    739000,
    829000,
    "ropa",
    "HOMBRE",
    false,
    8,
    ["chaqueta", "workwear"],
    true,
    "photo-1551028719-00167b16eac5",
  ],
  [
    "garmin-watch",
    "Forerunner 255",
    "Garmin",
    1199000,
    null,
    "tecnologia",
    "UNISEX",
    true,
    4,
    ["reloj", "deporte", "gps"],
    true,
    "photo-1523275335684-37898b6baf30",
  ],
] as const;

async function main() {
  console.log("🌱 Iniciando seed de 7H STORE...");

  console.log("📂 Creando categorías...");

  // Solo crea lo que falta: NUNCA sobrescribe nombres, precios ni inventario editados desde el panel.
  for (const [i, [slug, label]] of categories.entries()) {
    await prisma.category.upsert({
      where: { slug },
      update: {},
      create: {
        slug,
        label,
        sortOrder: (i + 1) * 10,
      },
    });
  }

  console.log(`✅ ${categories.length} categorías procesadas.`);

  console.log("🛍️ Creando productos...");

  let productCount = 0;

  for (const [
    slug,
    name,
    brand,
    price,
    compare,
    category,
    gender,
    isAccessory,
    stock,
    tags,
    featured,
    imageId,
  ] of products) {
    const c = await prisma.category.findUniqueOrThrow({
      where: {
        slug: category,
      },
    });

    await prisma.product.upsert({
      where: {
        slug,
      },
      // Si el producto ya existe, no se toca (el stock real lo maneja el panel).
      update: {},
      create: {
        slug,
        name,
        brand,
        description: `Producto original ${brand}. Selección 7H STORE con impuestos incluidos y envío a toda Colombia.`,
        priceCOP: price,
        compareAtPriceCOP: compare,
        categoryId: c.id,
        gender: gender as Gender,
        isAccessory,
        stock,
        tags: [...tags],
        featured,
        images: [img(imageId)],
        sizes:
          category === "calzado"
            ? ["36", "37", "38", "39", "40", "41", "42", "43"]
            : category === "ropa"
              ? ["S", "M", "L", "XL"]
              : [],
      },
    });

    productCount++;

    console.log(`   ✓ ${productCount}/${products.length} - ${name}`);
  }

  console.log(`\n✅ ${productCount} productos procesados.`);
  console.log("🎉 Seed de 7H STORE completado correctamente.");
}

main()
  .catch((error) => {
    console.error("\n❌ Error ejecutando el seed:");
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });