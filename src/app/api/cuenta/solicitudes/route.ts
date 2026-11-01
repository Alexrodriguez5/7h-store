import { NextResponse } from "next/server";
import { z } from "zod";
import { requireCustomer } from "@/lib/customer/auth";
import { readMultipart } from "@/lib/customer/multipart";
import { SupportError, createSupportRequest } from "@/lib/services/support";
import { consume, MIN, tooMany } from "@/lib/rate-limit";
import { SUPPORT_TYPES } from "@/lib/support";
import type { SupportType } from "@prisma/client";

const schema = z.object({
  orderCode: z.string().trim().min(5).max(40),
  type: z.enum(Object.keys(SUPPORT_TYPES) as [SupportType, ...SupportType[]]),
  reason: z.string().trim().min(3, "Escribe el motivo").max(160),
  description: z.string().trim().min(15, "Describe el problema con un poco más de detalle").max(4000),
  contactPhone: z.string().trim().regex(/^3\d{9}$/, "Celular colombiano de 10 dígitos").or(z.literal("")).optional(),
  items: z.array(z.object({ orderItemId: z.string().min(1).max(64), quantity: z.number().int().min(0).max(100) })).max(50).default([]),
});

/** Nueva solicitud de devolución, garantía o soporte. Solo sobre pedidos del correo verificado del cliente. */
export async function POST(req: Request) {
  const auth = await requireCustomer(req, { verified: true });
  if ("error" in auth) return auth.error;
  const lim = await consume(`support-new:${auth.customer.id}`, 10, 60 * MIN);
  if (!lim.allowed) return tooMany(lim.retryAfterSec, "Creaste muchas solicitudes seguidas. Espera un momento.");
  const m = await readMultipart(req, schema);
  if ("error" in m) return m.error;
  try {
    const r = await createSupportRequest(auth.customer, { ...m.data, contactPhone: m.data.contactPhone || undefined }, m.files);
    return NextResponse.json({ code: r.code }, { status: 201 });
  } catch (e) {
    if (e instanceof SupportError) return NextResponse.json({ error: e.message }, { status: e.status });
    console.error("[soporte]", e instanceof Error ? e.message : e);
    return NextResponse.json({ error: "No pudimos registrar la solicitud. Inténtalo de nuevo." }, { status: 500 });
  }
}
