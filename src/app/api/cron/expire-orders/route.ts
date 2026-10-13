import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { expireOrder } from "@/lib/services/order-lifecycle";
import { invalidateProducts } from "@/lib/cache";
import { safeEqual } from "@/lib/admin/password";

/** Expira pedidos vencidos (libera su stock) y limpia contadores viejos de límites de intentos. */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || !safeEqual(req.headers.get("authorization") ?? "", `Bearer ${secret}`)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  const candidates = await prisma.order.findMany({
    where: { status: "PENDING_PAYMENT", expiresAt: { lt: new Date() } },
    select: { id: true },
  });
  let expired = 0;
  for (const { id } of candidates) if (await expireOrder(id)) expired++;
  if (expired > 0) invalidateProducts();

  const purged = await prisma.rateLimit
    .deleteMany({ where: { resetAt: { lt: new Date(Date.now() - 24 * 3600_000) } } })
    .then((r) => r.count)
    .catch(() => 0);
  return NextResponse.json({ expired, purgedRateLimits: purged });
}
