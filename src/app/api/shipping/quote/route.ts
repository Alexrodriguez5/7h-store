import { NextResponse } from "next/server";
import { z } from "zod";
import { MIN, consume, tooMany } from "@/lib/rate-limit";
import { getClientIp, readJson } from "@/lib/request";
import { quoteCart } from "@/lib/services/shipping-quote";

const schema = z.object({
  department: z.string().trim().min(3).max(60),
  city: z.string().trim().max(80).default(""),
  items: z.array(z.object({ productId: z.string().min(1).max(64), quantity: z.number().int().positive().max(20) })).min(1).max(50),
});

/** Cotización del envío para el checkout (misma función que usa la creación del pedido). */
export async function POST(req: Request) {
  const limit = await consume(`shipquote:ip:${getClientIp(req)}`, 60, 10 * MIN);
  if (!limit.allowed) return tooMany(limit.retryAfterSec, "Demasiadas cotizaciones seguidas.");
  const parsed = schema.safeParse(await readJson(req));
  if (!parsed.success) return NextResponse.json({ error: "Datos de envío no válidos." }, { status: 400 });
  const q = await quoteCart({ department: parsed.data.department, city: parsed.data.city, lines: parsed.data.items });
  return NextResponse.json({ costCOP: q.costCOP, eta: q.eta, zone: q.zone, free: q.free, source: q.source });
}
