import { NextResponse } from "next/server";
import { requireCustomer } from "@/lib/customer/auth";
import { readMultipart } from "@/lib/customer/multipart";
import { consume, MIN, tooMany } from "@/lib/rate-limit";
import { createPost, postInput } from "@/lib/services/community";
import { UgcError } from "@/lib/ugc";

/** Nueva publicación en la Comunidad 7H (sesión con correo verificado; límite de frecuencia). */
export async function POST(req: Request) {
  const auth = await requireCustomer(req, { verified: true });
  if ("error" in auth) return auth.error;
  if (auth.customer.blockedAt) return NextResponse.json({ error: "Tu cuenta no puede publicar." }, { status: 403 });
  const lim = await consume(`comunidad-post:${auth.customer.id}`, 5, 24 * 60 * MIN);
  if (!lim.allowed) return tooMany(lim.retryAfterSec, "Llegaste al límite de publicaciones por hoy.");
  const m = await readMultipart(req, postInput);
  if ("error" in m) return m.error;
  if (m.files.length > 1) return NextResponse.json({ error: "Adjunta máximo una foto." }, { status: 400 });
  try {
    const p = await createPost(auth.customer, m.data, m.files[0]?.bytes ?? null);
    return NextResponse.json(p, { status: 201 });
  } catch (e) {
    if (e instanceof UgcError) return NextResponse.json({ error: e.message }, { status: e.status });
    console.error("[comunidad]", e instanceof Error ? e.message : e);
    return NextResponse.json({ error: "No pudimos publicar. Inténtalo de nuevo." }, { status: 500 });
  }
}
