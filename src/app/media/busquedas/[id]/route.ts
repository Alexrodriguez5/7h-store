import { prisma } from "@/lib/prisma";
import { getCurrentAdmin } from "@/lib/admin/guard";
import { getCurrentCustomer } from "@/lib/customer/auth";
import { serveUgc } from "@/lib/media-response";
import { canAccess } from "@/lib/services/special-requests";

/** Foto de referencia de una búsqueda personalizada: solo el equipo, el cliente dueño o quien tenga su enlace seguro. */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const img = await prisma.requestImage.findUnique({ where: { id: id.slice(0, 40) }, select: { path: true, mime: true, request: { select: { id: true, email: true, customerId: true } } } });
  if (!img) return new Response("No encontrado", { status: 404 });
  const token = new URL(req.url).searchParams.get("t");
  const [admin, customer] = await Promise.all([getCurrentAdmin(), getCurrentCustomer().catch(() => null)]);
  if (!admin && !(await canAccess(img.request, { customer, token }))) return new Response("No encontrado", { status: 404 });
  return serveUgc(img.path, img.mime, false);
}
