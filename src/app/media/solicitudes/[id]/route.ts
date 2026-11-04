import { prisma } from "@/lib/prisma";
import { getCurrentAdmin } from "@/lib/admin/guard";
import { serveUgc } from "@/lib/media-response";

/** Foto de referencia de una solicitud: solo la ve el equipo. */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await getCurrentAdmin())) return new Response("No encontrado", { status: 404 });
  const { id } = await params;
  const r = await prisma.productRequest.findUnique({ where: { id: id.slice(0, 40) }, select: { imagePath: true, imageMime: true } });
  if (!r?.imagePath || !r.imageMime) return new Response("No encontrado", { status: 404 });
  return serveUgc(r.imagePath, r.imageMime, false);
}
