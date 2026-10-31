import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { CUSTOMER_COOKIE, customerFromToken } from "@/lib/customer/auth";
import { getSessionAdmin } from "@/lib/admin/auth";
import { COOKIE_NAME } from "@/lib/admin/session";
import { readCookieValue } from "@/lib/request";

/** Evidencia de una solicitud: solo la ve su cliente o un administrador. Nunca hay enlaces públicos. */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const att = await prisma.supportAttachment.findUnique({ where: { id }, include: { request: { select: { customerId: true } } } });
  if (!att) return NextResponse.json({ error: "No encontrado" }, { status: 404 });
  const customer = await customerFromToken(readCookieValue(req, CUSTOMER_COOKIE));
  const allowed = customer?.id === att.request.customerId || !!(await getSessionAdmin(readCookieValue(req, COOKIE_NAME)));
  if (!allowed) return NextResponse.json({ error: "No autorizado" }, { status: 404 });
  return new NextResponse(new Uint8Array(att.data), {
    headers: {
      "Content-Type": att.mime,
      "Content-Length": String(att.size),
      "Content-Disposition": `inline; filename="${att.fileName.replace(/"/g, "")}"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
