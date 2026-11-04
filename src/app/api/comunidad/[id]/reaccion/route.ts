import { NextResponse } from "next/server";
import { requireCustomer } from "@/lib/customer/auth";
import { consume, MIN, tooMany } from "@/lib/rate-limit";
import { toggleReaction } from "@/lib/services/community";
import { UgcError } from "@/lib/ugc";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireCustomer(req);
  if ("error" in auth) return auth.error;
  const lim = await consume(`comunidad-like:${auth.customer.id}`, 120, 10 * MIN);
  if (!lim.allowed) return tooMany(lim.retryAfterSec);
  const { id } = await params;
  try {
    return NextResponse.json(await toggleReaction(auth.customer.id, id.slice(0, 40)));
  } catch (e) {
    if (e instanceof UgcError) return NextResponse.json({ error: e.message }, { status: e.status });
    return NextResponse.json({ error: "No se pudo registrar." }, { status: 500 });
  }
}
