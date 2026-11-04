import { NextResponse } from "next/server";
import { requireCustomer } from "@/lib/customer/auth";
import { consume, MIN, tooMany } from "@/lib/rate-limit";
import { readJson } from "@/lib/request";
import { report, reportInput } from "@/lib/services/community";
import { UgcError } from "@/lib/ugc";

/** Reportar una publicación o un comentario inapropiado. */
export async function POST(req: Request) {
  const auth = await requireCustomer(req);
  if ("error" in auth) return auth.error;
  const lim = await consume(`comunidad-rep:${auth.customer.id}`, 20, 60 * MIN);
  if (!lim.allowed) return tooMany(lim.retryAfterSec);
  const parsed = reportInput.safeParse(await readJson(req));
  if (!parsed.success) return NextResponse.json({ error: "Cuéntanos el motivo del reporte." }, { status: 400 });
  try {
    return NextResponse.json(await report(auth.customer.id, parsed.data), { status: 201 });
  } catch (e) {
    if (e instanceof UgcError) return NextResponse.json({ error: e.message }, { status: e.status });
    return NextResponse.json({ error: "No se pudo enviar el reporte." }, { status: 500 });
  }
}
