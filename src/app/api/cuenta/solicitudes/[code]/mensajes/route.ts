import { NextResponse } from "next/server";
import { z } from "zod";
import { requireCustomer } from "@/lib/customer/auth";
import { readMultipart } from "@/lib/customer/multipart";
import { SupportError, addCustomerMessage } from "@/lib/services/support";
import { consume, MIN, tooMany } from "@/lib/rate-limit";

const schema = z.object({ text: z.string().trim().min(2, "Escribe tu mensaje").max(4000) });

export async function POST(req: Request, { params }: { params: Promise<{ code: string }> }) {
  const auth = await requireCustomer(req, { verified: true });
  if ("error" in auth) return auth.error;
  const lim = await consume(`support-msg:${auth.customer.id}`, 30, 60 * MIN);
  if (!lim.allowed) return tooMany(lim.retryAfterSec);
  const m = await readMultipart(req, schema);
  if ("error" in m) return m.error;
  try {
    await addCustomerMessage(auth.customer, (await params).code, m.data.text, m.files);
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof SupportError) return NextResponse.json({ error: e.message }, { status: e.status });
    console.error("[soporte]", e instanceof Error ? e.message : e);
    return NextResponse.json({ error: "No pudimos enviar el mensaje." }, { status: 500 });
  }
}
