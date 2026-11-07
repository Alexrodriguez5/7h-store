import { NextResponse } from "next/server";
import { auraConfig } from "@/lib/aura/config";
import { getCurrentCustomer } from "@/lib/customer/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/**
 * GET /api/aura/estado — lo que la interfaz necesita al abrir AURA: si la IA está activa y, para un
 * cliente con sesión, sus búsquedas que esperan respuesta (propuestas del equipo). Esto lo muestra la
 * aplicación; el modelo no lo recibe.
 */
export async function GET() {
  const cfg = auraConfig();
  const c = await getCurrentCustomer().catch(() => null);
  const proposals = c?.emailVerifiedAt
    ? await prisma.productRequest
        .findMany({ where: { OR: [{ customerId: c.id }, { email: c.email }], status: "ESPERANDO_CLIENTE" }, select: { code: true, productName: true }, orderBy: { updatedAt: "desc" }, take: 3 })
        .catch(() => [])
    : [];
  return NextResponse.json({ enabled: cfg.enabled, signedIn: !!c, verified: !!c?.emailVerifiedAt, proposals }, { headers: { "Cache-Control": "no-store" } });
}
