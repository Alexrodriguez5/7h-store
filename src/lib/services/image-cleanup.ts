import { prisma } from "@/lib/prisma";
import { deleteUnusedImages } from "@/lib/storage";

/** Borra del almacenamiento las imágenes quitadas que ya no usa ningún producto ni categoría. */
export function cleanupImages(urls: string[]) {
  return deleteUnusedImages(urls, async (url) => {
    const [products, categories] = await Promise.all([
      prisma.product.count({ where: { images: { has: url } } }),
      prisma.category.count({ where: { imageUrl: url } }),
    ]);
    return products + categories > 0;
  });
}
