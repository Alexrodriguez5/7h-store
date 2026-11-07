import { NextResponse } from "next/server";
import { getCurrentCustomer } from "@/lib/customer/auth";
import { readMultipart } from "@/lib/customer/multipart";
import { consume, MIN, tooMany } from "@/lib/rate-limit";
import { getClientIp, isSameOrigin } from "@/lib/request";
import { MAX_REQUEST_PHOTOS, createProductRequest, productRequestInput } from "@/lib/services/product-requests";
import { UgcError } from "@/lib/ugc";

/**
 * AURA · Búsqueda personalizada. No exige cuenta: límite por IP y por correo, campo trampa contra robots,
 * hasta 4 fotos validadas por sus bytes (bucket privado) y enlaces guardados como texto (nunca se visitan).
 */
export async function POST(req: Request) {
  if (!isSameOrigin(req)) return NextResponse.json({ error: "Origen no permitido" }, { status: 403 });
  const ip = await consume(`busqueda:ip:${getClientIp(req)}`, 6, 60 * MIN);
  if (!ip.allowed) return tooMany(ip.retryAfterSec, "Enviaste varias solicitudes seguidas. Espera un momento.");
  const m = await readMultipart(req, productRequestInput);
  if ("error" in m) return m.error;
  const mail = await consume(`busqueda:mail:${m.data.email}`, 6, 24 * 60 * MIN);
  if (!mail.allowed) return tooMany(mail.retryAfterSec, "Ya recibimos varias solicitudes de este correo hoy.");
  if (m.files.length > MAX_REQUEST_PHOTOS) return NextResponse.json({ error: `Adjunta máximo ${MAX_REQUEST_PHOTOS} fotos.` }, { status: 400 });
  try {
    const customer = await getCurrentCustomer().catch(() => null);
    // Solo se asocia a la cuenta si el correo coincide con el de la sesión verificada.
    const owner = customer?.emailVerifiedAt && customer.email === m.data.email ? customer.id : null;
    const r = await createProductRequest(m.data, m.files.map((f) => f.bytes), owner);
    return NextResponse.json(r, { status: r.duplicate ? 200 : 201 });
  } catch (e) {
    if (e instanceof UgcError) return NextResponse.json({ error: e.message }, { status: e.status });
    console.error("[busqueda]", e instanceof Error ? e.message : e);
    return NextResponse.json({ error: "No pudimos registrar tu solicitud. Inténtalo de nuevo." }, { status: 500 });
  }
}
