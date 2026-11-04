import { NextResponse } from "next/server";
import { requireCustomer } from "@/lib/customer/auth";
import { withdrawMedia } from "@/lib/services/gallery";
import { UgcError } from "@/lib/ugc";

/** El cliente retira su foto de la galería (deja de verse de inmediato y se borra el archivo). */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireCustomer(req);
  if ("error" in auth) return auth.error;
  const { id } = await params;
  try {
    await withdrawMedia(auth.customer.id, id.slice(0, 40));
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof UgcError) return NextResponse.json({ error: e.message }, { status: e.status });
    return NextResponse.json({ error: "No se pudo retirar." }, { status: 500 });
  }
}
