import { prisma } from "@/lib/prisma";
import { getCurrentAdmin } from "@/lib/admin/guard";
import { getCurrentCustomer } from "@/lib/customer/auth";
import { serveUgc } from "@/lib/media-response";

/** Foto de cliente en la galería: pública solo si está aprobada; también la ven su autor y el equipo. */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const m = await prisma.mediaItem.findUnique({ where: { id: id.slice(0, 40) }, select: { path: true, mime: true, status: true, withdrawnAt: true, source: true, customerId: true } });
  if (!m || m.source !== "customer" || !m.mime || m.withdrawnAt) return new Response("No encontrado", { status: 404 });
  const approved = m.status === "APROBADA";
  if (!approved) {
    const [admin, customer] = await Promise.all([getCurrentAdmin(), getCurrentCustomer().catch(() => null)]);
    if (!admin && customer?.id !== m.customerId) return new Response("No encontrado", { status: 404 });
  }
  return serveUgc(m.path, m.mime, approved);
}
