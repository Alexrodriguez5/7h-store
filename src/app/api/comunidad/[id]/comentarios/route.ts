import { NextResponse } from "next/server";
import { requireCustomer } from "@/lib/customer/auth";
import { consume, MIN, tooMany } from "@/lib/rate-limit";
import { readJson } from "@/lib/request";
import { addComment, commentInput } from "@/lib/services/community";
import { UgcError } from "@/lib/ugc";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireCustomer(req, { verified: true });
  if ("error" in auth) return auth.error;
  if (auth.customer.blockedAt) return NextResponse.json({ error: "Tu cuenta no puede comentar." }, { status: 403 });
  const lim = await consume(`comunidad-com:${auth.customer.id}`, 30, 60 * MIN);
  if (!lim.allowed) return tooMany(lim.retryAfterSec, "Comentaste muchas veces seguidas. Espera un momento.");
  const parsed = commentInput.safeParse(await readJson(req));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Datos no válidos" }, { status: 400 });
  const { id } = await params;
  try {
    return NextResponse.json(await addComment(auth.customer, id.slice(0, 40), parsed.data), { status: 201 });
  } catch (e) {
    if (e instanceof UgcError) return NextResponse.json({ error: e.message }, { status: e.status });
    return NextResponse.json({ error: "No se pudo comentar." }, { status: 500 });
  }
}
