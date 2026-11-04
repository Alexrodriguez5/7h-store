import { NextResponse } from "next/server";
import { getCurrentCustomer } from "@/lib/customer/auth";
import { readMultipart } from "@/lib/customer/multipart";
import { consume, MIN, tooMany } from "@/lib/rate-limit";
import { getClientIp, isSameOrigin } from "@/lib/request";
import { createProductRequest, productRequestInput } from "@/lib/services/product-requests";
import { UgcError } from "@/lib/ugc";

/** Solicitud de producto. No exige cuenta: se limita por IP y por correo, con campo trampa contra robots. */
export async function POST(req: Request) {
  if (!isSameOrigin(req)) return NextResponse.json({ error: "Origen no permitido" }, { status: 403 });
  const ip = await consume(`busqueda:ip:${getClientIp(req)}`, 5, 60 * MIN);
  if (!ip.allowed) return tooMany(ip.retryAfterSec, "Enviaste varias solicitudes seguidas. Espera un momento.");
  const m = await readMultipart(req, productRequestInput);
  if ("error" in m) return m.error;
  const mail = await consume(`busqueda:mail:${m.data.email}`, 5, 24 * 60 * MIN);
  if (!mail.allowed) return tooMany(mail.retryAfterSec, "Ya recibimos varias solicitudes de este correo hoy.");
  if (m.files.length > 1) return NextResponse.json({ error: "Adjunta máximo una foto." }, { status: 400 });
  try {
    const customer = await getCurrentCustomer().catch(() => null);
    const r = await createProductRequest(m.data, m.files[0]?.bytes ?? null, customer?.id ?? null);
    return NextResponse.json({ code: r.code }, { status: 201 });
  } catch (e) {
    if (e instanceof UgcError) return NextResponse.json({ error: e.message }, { status: e.status });
    console.error("[tu-lo-buscas]", e instanceof Error ? e.message : e);
    return NextResponse.json({ error: "No pudimos registrar tu solicitud. Inténtalo de nuevo." }, { status: 500 });
  }
}
