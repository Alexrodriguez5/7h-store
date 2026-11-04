import { NextResponse } from "next/server";
import { getCurrentCustomer } from "@/lib/customer/auth";
import { consume, MIN, tooMany } from "@/lib/rate-limit";
import { getClientIp, isSameOrigin, readJson } from "@/lib/request";
import { createInquiry, inquiryInput } from "@/lib/services/inquiries";
import { UgcError } from "@/lib/ugc";

/** Nueva consulta a la tienda. No exige cuenta; límite por IP y correo, campo trampa contra robots. */
export async function POST(req: Request) {
  if (!isSameOrigin(req)) return NextResponse.json({ error: "Origen no permitido" }, { status: 403 });
  const ip = await consume(`consulta:ip:${getClientIp(req)}`, 6, 60 * MIN);
  if (!ip.allowed) return tooMany(ip.retryAfterSec, "Enviaste varias consultas seguidas. Espera un momento.");
  const parsed = inquiryInput.safeParse(await readJson(req));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Datos no válidos" }, { status: 400 });
  const mail = await consume(`consulta:mail:${parsed.data.email}`, 6, 24 * 60 * MIN);
  if (!mail.allowed) return tooMany(mail.retryAfterSec, "Ya recibimos varias consultas de este correo hoy.");
  try {
    const customer = await getCurrentCustomer().catch(() => null);
    const r = await createInquiry(parsed.data, customer && customer.email === parsed.data.email ? customer.id : null);
    return NextResponse.json(r, { status: 201 });
  } catch (e) {
    if (e instanceof UgcError) return NextResponse.json({ error: e.message }, { status: e.status });
    console.error("[consultas]", e instanceof Error ? e.message : e);
    return NextResponse.json({ error: "No pudimos enviar tu consulta. Inténtalo de nuevo." }, { status: 500 });
  }
}
