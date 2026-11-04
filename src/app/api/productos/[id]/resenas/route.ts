import { NextResponse } from "next/server";
import { requireCustomer } from "@/lib/customer/auth";
import { readMultipart } from "@/lib/customer/multipart";
import { consume, MIN, tooMany } from "@/lib/rate-limit";
import { reviewInput, submitReview } from "@/lib/services/reviews";
import { UgcError } from "@/lib/ugc";

/** Nueva reseña (o edición de la propia). Exige sesión con correo verificado; queda pendiente de moderación. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireCustomer(req, { verified: true });
  if ("error" in auth) return auth.error;
  const lim = await consume(`review:${auth.customer.id}`, 6, 60 * MIN);
  if (!lim.allowed) return tooMany(lim.retryAfterSec, "Enviaste varias reseñas seguidas. Espera un momento.");
  const m = await readMultipart(req, reviewInput);
  if ("error" in m) return m.error;
  const { id } = await params;
  try {
    const r = await submitReview(auth.customer, id.slice(0, 40), m.data, m.files.map((f) => f.bytes));
    return NextResponse.json({ ok: true, verified: r.verified, updated: r.updated }, { status: 201 });
  } catch (e) {
    if (e instanceof UgcError) return NextResponse.json({ error: e.message }, { status: e.status });
    console.error("[reseñas]", e instanceof Error ? e.message : e);
    return NextResponse.json({ error: "No pudimos enviar tu reseña. Inténtalo de nuevo." }, { status: 500 });
  }
}
