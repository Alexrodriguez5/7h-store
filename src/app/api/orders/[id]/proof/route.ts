import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { detectProofType, MAX_PROOF_BYTES } from "@/lib/images";
import { MIN, consume, tooMany } from "@/lib/rate-limit";
import { getClientIp } from "@/lib/request";

const MAX_PROOFS_PER_ORDER = 3;

/**
 * Comprobante de transferencia/consignación. Reglas:
 * - El cliente debe indicar el correo del pedido (el código solo no basta).
 * - Solo pedidos con pago manual y pendientes de pago.
 * - Se valida el tipo REAL del archivo (JPG/PNG/PDF por sus primeros bytes), máximo 5 MB y 3 comprobantes por pedido.
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const limit = await consume(`proof:ip:${getClientIp(req)}`, 10, 60 * MIN);
  if (!limit.allowed) return tooMany(limit.retryAfterSec, "Demasiados intentos. Espera un momento.");

  const declared = Number(req.headers.get("content-length") ?? 0);
  if (declared > MAX_PROOF_BYTES + 64 * 1024) return NextResponse.json({ error: "El comprobante debe pesar máximo 5 MB." }, { status: 413 });

  const { id } = await params;
  const form = await req.formData().catch(() => null);
  const email = String(form?.get("email") ?? "").trim().toLowerCase();
  const file = form?.get("file");
  if (!email) return NextResponse.json({ error: "Escribe el correo con el que hiciste el pedido." }, { status: 400 });
  if (!(file instanceof File)) return NextResponse.json({ error: "Adjunta un comprobante." }, { status: 400 });

  const order = await prisma.order.findFirst({
    where: { publicCode: id, customerEmail: email },
    select: { id: true, status: true, paymentMethod: true, totalCOP: true, _count: { select: { payments: { where: { proofUrl: { not: null } } } } } },
  });
  // Mismo mensaje si el código o el correo no coinciden: no se revela qué dato falló.
  if (!order) return NextResponse.json({ error: "No encontramos un pedido con ese número y correo." }, { status: 404 });
  if (order.paymentMethod !== "BANK_TRANSFER" && order.paymentMethod !== "CASH_DEPOSIT") {
    return NextResponse.json({ error: "Este pedido se paga en línea; no necesita comprobante." }, { status: 409 });
  }
  if (order.status !== "PENDING_PAYMENT") return NextResponse.json({ error: "Este pedido ya no está pendiente de pago." }, { status: 409 });
  if (order._count.payments >= MAX_PROOFS_PER_ORDER) {
    return NextResponse.json({ error: "Ya recibimos varios comprobantes para este pedido. Escríbenos si necesitas corregir algo." }, { status: 409 });
  }
  if (file.size === 0 || file.size > MAX_PROOF_BYTES) return NextResponse.json({ error: "El comprobante debe pesar máximo 5 MB." }, { status: 400 });

  const bytes = Buffer.from(await file.arrayBuffer());
  const type = detectProofType(bytes);
  if (!type) return NextResponse.json({ error: "El comprobante debe ser JPG, PNG o PDF." }, { status: 400 });

  const dataUrl = `data:${type.mime};base64,${bytes.toString("base64")}`;
  await prisma.payment.create({ data: { orderId: order.id, provider: "manual", status: "PENDING", amountCOP: order.totalCOP, proofUrl: dataUrl } });
  return NextResponse.json({ ok: true, message: "Comprobante recibido. Lo revisaremos y te confirmaremos el pago." });
}
