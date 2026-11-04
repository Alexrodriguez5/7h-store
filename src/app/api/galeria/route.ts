import { NextResponse } from "next/server";
import { requireCustomer } from "@/lib/customer/auth";
import { readMultipart } from "@/lib/customer/multipart";
import { consume, MIN, tooMany } from "@/lib/rate-limit";
import { customerMediaInput, submitCustomerMedia } from "@/lib/services/gallery";
import { UgcError } from "@/lib/ugc";

/** Un cliente comparte una foto para "Así se vive 7H". Queda pendiente hasta que el equipo la apruebe. */
export async function POST(req: Request) {
  const auth = await requireCustomer(req, { verified: true });
  if ("error" in auth) return auth.error;
  const lim = await consume(`galeria:${auth.customer.id}`, 6, 60 * MIN);
  if (!lim.allowed) return tooMany(lim.retryAfterSec, "Compartiste varias fotos seguidas. Espera un momento.");
  const m = await readMultipart(req, customerMediaInput);
  if ("error" in m) return m.error;
  if (m.files.length !== 1) return NextResponse.json({ error: "Adjunta una foto." }, { status: 400 });
  try {
    await submitCustomerMedia(auth.customer, m.data, m.files[0].bytes);
    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (e) {
    if (e instanceof UgcError) return NextResponse.json({ error: e.message }, { status: e.status });
    console.error("[galeria]", e instanceof Error ? e.message : e);
    return NextResponse.json({ error: "No pudimos recibir tu foto." }, { status: 500 });
  }
}
