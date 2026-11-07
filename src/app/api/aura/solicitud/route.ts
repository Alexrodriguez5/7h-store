import { NextResponse } from "next/server";
import { AuraRequestError, confirmAuraRequest, confirmInput } from "@/lib/aura/request";
import { requireCustomer } from "@/lib/customer/auth";
import { readMultipart } from "@/lib/customer/multipart";
import { consume, MIN, tooMany } from "@/lib/rate-limit";
import { getClientIp } from "@/lib/request";

export const runtime = "nodejs";

/**
 * POST /api/aura/solicitud — el cliente CONFIRMA la solicitud que AURA preparó.
 * Exige sesión con correo verificado (si no la tiene, la interfaz usa el código por correo que ya existe).
 * Las fotos van directo al almacenamiento privado; nunca al modelo.
 */
export async function POST(req: Request) {
  const auth = await requireCustomer(req, { verified: true });
  if ("error" in auth) return NextResponse.json({ error: "Verifica tu correo para registrar la solicitud.", needsVerification: true }, { status: 401 });
  const limit = await consume(`aura:confirm:${auth.customer.id}`, 6, 60 * MIN);
  if (!limit.allowed) return tooMany(limit.retryAfterSec, "Registraste varias solicitudes seguidas. Espera un momento.");
  const m = await readMultipart(req, confirmInput);
  if ("error" in m) return m.error;
  try {
    const r = await confirmAuraRequest(m.data, m.files.map((f) => f.bytes), { customer: auth.customer, ip: getClientIp(req) });
    return NextResponse.json(r, { status: r.duplicate ? 200 : 201 });
  } catch (e) {
    if (e instanceof AuraRequestError) return NextResponse.json({ error: e.message }, { status: e.status });
    console.error("[aura] solicitud:", e instanceof Error ? e.message : e);
    return NextResponse.json({ error: "No pudimos registrar la solicitud. Inténtalo de nuevo." }, { status: 500 });
  }
}
