import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getCurrentCustomer } from "@/lib/customer/auth";
import { consume, MIN, tooMany } from "@/lib/rate-limit";
import { getClientIp, isSameOrigin, readJson } from "@/lib/request";
import { RequestError, canAccess, customerAct, customerActionInput } from "@/lib/services/special-requests";

const body = z.object({ t: z.string().max(100).optional() }).and(customerActionInput);

/** El cliente pregunta, acepta una alternativa o rechaza la propuesta (con su sesión o su enlace seguro). */
export async function POST(req: Request, { params }: { params: Promise<{ code: string }> }) {
  if (!isSameOrigin(req)) return NextResponse.json({ error: "Origen no permitido" }, { status: 403 });
  const lim = await consume(`busqueda-accion:${getClientIp(req)}`, 30, 60 * MIN);
  if (!lim.allowed) return tooMany(lim.retryAfterSec);
  const parsed = body.safeParse(await readJson(req));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Datos no válidos" }, { status: 400 });
  const { code } = await params;
  const r = await prisma.productRequest.findUnique({ where: { code: code.slice(0, 30) }, select: { id: true, email: true, customerId: true } });
  const customer = await getCurrentCustomer().catch(() => null);
  // Misma respuesta si no existe o si no es suya: no se revela que la solicitud existe.
  if (!r || !(await canAccess(r, { customer, token: parsed.data.t }))) return NextResponse.json({ error: "Solicitud no encontrada." }, { status: 404 });
  try {
    const { t: _t, ...action } = parsed.data; // eslint-disable-line @typescript-eslint/no-unused-vars
    return NextResponse.json(await customerAct(r.id, action));
  } catch (e) {
    if (e instanceof RequestError) return NextResponse.json({ error: e.message }, { status: e.status });
    console.error("[busqueda-accion]", e instanceof Error ? e.message : e);
    return NextResponse.json({ error: "No se pudo completar." }, { status: 500 });
  }
}
