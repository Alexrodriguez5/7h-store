import { prisma } from "@/lib/prisma";
import { getCurrentAdmin } from "@/lib/admin/guard";
import { serveUgc } from "@/lib/media-response";

/** Foto de reseña: pública solo si la reseña está aprobada; el equipo ve también las pendientes. */
export async function GET(_req: Request, { params }: { params: Promise<{ photoId: string }> }) {
  const { photoId } = await params;
  const photo = await prisma.reviewPhoto.findUnique({ where: { id: photoId.slice(0, 40) }, select: { path: true, mime: true, review: { select: { status: true } } } });
  if (!photo) return new Response("No encontrado", { status: 404 });
  const approved = photo.review.status === "APROBADA";
  if (!approved && !(await getCurrentAdmin())) return new Response("No encontrado", { status: 404 });
  return serveUgc(photo.path, photo.mime, approved);
}
