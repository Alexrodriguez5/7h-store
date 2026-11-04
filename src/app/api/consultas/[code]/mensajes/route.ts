import { NextResponse } from "next/server";
import { getCurrentCustomer } from "@/lib/customer/auth";
import { consume, MIN, tooMany } from "@/lib/rate-limit";
import { getClientIp, isSameOrigin, readJson } from "@/lib/request";
import { addCustomerMessage, messageInput } from "@/lib/services/inquiries";
import { UgcError } from "@/lib/ugc";

/** El cliente responde en su conversación (con su sesión o con el enlace del correo). */
export async function POST(req: Request, { params }: { params: Promise<{ code: string }> }) {
  if (!isSameOrigin(req)) return NextResponse.json({ error: "Origen no permitido" }, { status: 403 });
  const lim = await consume(`consulta-msg:ip:${getClientIp(req)}`, 20, 60 * MIN);
  if (!lim.allowed) return tooMany(lim.retryAfterSec);
  const parsed = messageInput.safeParse(await readJson(req));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Datos no válidos" }, { status: 400 });
  const { code } = await params;
  try {
    const customer = await getCurrentCustomer().catch(() => null);
    await addCustomerMessage(code.slice(0, 30), parsed.data.message, { customerId: customer?.id, token: parsed.data.t });
    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (e) {
    if (e instanceof UgcError) return NextResponse.json({ error: e.message }, { status: e.status });
    return NextResponse.json({ error: "No se pudo enviar el mensaje." }, { status: 500 });
  }
}
