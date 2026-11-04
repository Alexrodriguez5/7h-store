import { readUgcPhoto } from "@/lib/ugc";

/**
 * Entrega una foto privada del bucket de clientes.
 * `publicCache`: true solo para contenido APROBADO (se puede guardar en caché del navegador y la CDN).
 */
export async function serveUgc(path: string, mime: string, publicCache: boolean) {
  const res = await readUgcPhoto(path);
  if (!res?.body) return new Response("No encontrado", { status: 404 });
  return new Response(res.body, {
    headers: {
      "Content-Type": mime,
      "Cache-Control": publicCache ? "public, max-age=86400, s-maxage=604800" : "private, no-store",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'; img-src 'self'; style-src 'none'; sandbox",
      "Cross-Origin-Resource-Policy": "same-origin",
    },
  });
}
