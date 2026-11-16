import { notFound } from "next/navigation";
import { getProductBySlug } from "@/services/products";

/**
 * Comprueba que el producto exista ANTES de que `loading.tsx` envíe la respuesta.
 * Sin esto, `notFound()` dentro de la página llega tarde (ya se envió un 200 por streaming)
 * y Google ve un «soft 404». La lectura usa la lista en caché, sin consulta extra.
 */
export default async function ProductLayout({ children, params }: { children: React.ReactNode; params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  if (!(await getProductBySlug(slug))) notFound();
  return children;
}
