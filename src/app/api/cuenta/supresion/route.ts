import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireCustomer } from "@/lib/customer/auth";
import { body, fail } from "@/lib/customer/http";
import { deliverLater, supportInbox } from "@/lib/mailer";

const schema = z.object({ kind: z.enum(["actualizar", "suprimir"]), details: z.string().trim().min(10, "Cuéntanos qué necesitas").max(2000) });

/**
 * Derechos de habeas data (Ley 1581): solicitud de actualización o supresión de datos.
 * No se borra nada automáticamente (los pedidos se conservan por obligación contable): el equipo la gestiona
 * y responde en máximo 15 días hábiles.
 */
export async function POST(req: Request) {
  const auth = await requireCustomer(req, { verified: true });
  if ("error" in auth) return auth.error;
  const b = await body(req, schema);
  if ("error" in b) return b.error;
  try {
    const c = auth.customer;
    if (b.data.kind === "suprimir") await prisma.customer.update({ where: { id: c.id }, data: { deletionRequestedAt: new Date() } });
    const inbox = supportInbox();
    if (inbox) {
      deliverLater({
        to: inbox, kind: "privacy.request", subject: `Solicitud de datos personales (${b.data.kind}) · ${c.email}`, heading: "Nueva solicitud de datos personales",
        paragraphs: [`Cliente: ${c.name} (${c.email})`, `Tipo: ${b.data.kind === "suprimir" ? "Supresión de datos" : "Actualización de datos"}`, b.data.details, "Plazo legal de respuesta: 15 días hábiles (Ley 1581 de 2012)."],
      });
    }
    deliverLater({
      to: c.email, kind: "privacy.ack", subject: "Recibimos tu solicitud de datos personales · 7H STORE", heading: "Recibimos tu solicitud",
      paragraphs: ["Gestionaremos tu solicitud sobre tus datos personales y te responderemos en máximo 15 días hábiles.", "Por obligaciones contables y legales, la información de tus pedidos se conserva durante el tiempo que exige la ley."],
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return fail(e);
  }
}
