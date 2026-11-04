import { prisma } from "@/lib/prisma";
import { getCurrentAdmin } from "@/lib/admin/guard";
import { getCurrentCustomer } from "@/lib/customer/auth";
import { serveUgc } from "@/lib/media-response";

/** Foto de una publicación: pública si la publicación está aprobada; también la ven su autor y el equipo. */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const p = await prisma.communityPost.findUnique({ where: { id: id.slice(0, 40) }, select: { imagePath: true, imageMime: true, status: true, customerId: true } });
  if (!p?.imagePath || !p.imageMime) return new Response("No encontrado", { status: 404 });
  const approved = p.status === "APROBADA";
  if (!approved) {
    const [admin, customer] = await Promise.all([getCurrentAdmin(), getCurrentCustomer().catch(() => null)]);
    if (!admin && customer?.id !== p.customerId) return new Response("No encontrado", { status: 404 });
  }
  return serveUgc(p.imagePath, p.imageMime, approved);
}
