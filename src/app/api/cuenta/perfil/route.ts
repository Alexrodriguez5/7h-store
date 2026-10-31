import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireCustomer } from "@/lib/customer/auth";
import { body, fail } from "@/lib/customer/http";

const schema = z.object({
  name: z.string().trim().min(3, "Escribe tu nombre completo").max(120),
  phone: z.string().trim().regex(/^3\d{9}$/, "Celular colombiano de 10 dígitos").or(z.literal("")).optional(),
});

/** Datos del perfil. El correo no se cambia aquí (es la llave de tus pedidos); cambiarlo requiere atención al cliente. Los pedidos conservan sus datos históricos. */
export async function PATCH(req: Request) {
  const auth = await requireCustomer(req);
  if ("error" in auth) return auth.error;
  const b = await body(req, schema);
  if ("error" in b) return b.error;
  try {
    const c = await prisma.customer.update({ where: { id: auth.customer.id }, data: { name: b.data.name, phone: b.data.phone || null }, select: { name: true, phone: true } });
    return NextResponse.json({ ok: true, customer: c });
  } catch (e) {
    return fail(e);
  }
}
