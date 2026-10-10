import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { expireOrder } from "@/lib/services/order-lifecycle";

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  const candidates = await prisma.order.findMany({
    where: { status: "PENDING_PAYMENT", expiresAt: { lt: new Date() } },
    select: { id: true },
  });
  let expired = 0;
  for (const { id } of candidates) if (await expireOrder(id)) expired++;
  return NextResponse.json({ expired });
}
