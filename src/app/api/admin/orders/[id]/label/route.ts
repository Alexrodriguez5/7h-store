import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/admin/guard";
import { handleError, parseBody } from "@/lib/admin/http";
import { audit } from "@/lib/admin/audit";
import { prisma } from "@/lib/prisma";
import { EnviaError, generateLabel, isEnviaConfigured, parcelFor, quoteRates, type EnviaAddress } from "@/lib/envia";

const input = z.object({
  action: z.enum(["quote", "generate"]),
  carrier: z.string().trim().min(2).max(40).optional(),
  service: z.string().trim().min(1).max(60).optional(),
});

type Ctx = { params: Promise<{ id: string }> };

/**
 * Guías con Envia desde el panel: "quote" compara tarifas de las transportadoras configuradas;
 * "generate" crea la guía y guarda transportadora y número en el pedido (sin cambiar su estado:
 * el admin lo marca como Enviado, lo que además avisa al cliente por correo).
 */
export async function POST(req: Request, { params }: Ctx) {
  const { ctx, error } = await requireAdmin(req);
  if (error) return error;
  if (!isEnviaConfigured()) return NextResponse.json({ error: "Envia no está configurado (falta ENVIA_API_TOKEN en Vercel)." }, { status: 503 });
  const body = await parseBody(req, input);
  if ("error" in body) return body.error;
  const { id } = await params;
  try {
    const order = await prisma.order.findUnique({
      where: { id },
      include: { items: { include: { product: { select: { weightGrams: true, lengthCm: true, widthCm: true, heightCm: true } } } } },
    });
    if (!order) return NextResponse.json({ error: "Pedido no encontrado." }, { status: 404 });
    if (order.status !== "PAID" && order.status !== "PROCESSING") return NextResponse.json({ error: "Solo se generan guías para pedidos pagados o en preparación." }, { status: 409 });

    const destination: EnviaAddress = {
      name: order.customerFullName, phone: order.customerPhone, email: order.customerEmail, street: order.address,
      city: order.city, department: order.department, idNumber: order.documentNumber, reference: order.notes ?? "",
    };
    const parcel = parcelFor(order.items.map((i) => ({ ...i.product, quantity: i.quantity, name: i.name })), order.subtotalCOP);

    if (body.data.action === "quote") {
      const rates = await quoteRates(destination, parcel);
      if (rates.length === 0) return NextResponse.json({ error: "Ninguna transportadora devolvió tarifa para este destino." }, { status: 422 });
      return NextResponse.json({ rates, parcel: { weightKg: parcel.weightKg, lengthCm: parcel.lengthCm, widthCm: parcel.widthCm, heightCm: parcel.heightCm } });
    }

    // Evita guías duplicadas (cada guía cuesta).
    if (order.trackingNumber) return NextResponse.json({ error: `Este pedido ya tiene la guía ${order.trackingNumber}.` }, { status: 409 });
    let { carrier, service } = body.data;
    if (!carrier || !service) {
      const [cheapest] = await quoteRates(destination, parcel);
      if (!cheapest) return NextResponse.json({ error: "Ninguna transportadora devolvió tarifa para este destino." }, { status: 422 });
      ({ carrier, service } = cheapest);
    }
    const label = await generateLabel(destination, parcel, { carrier, service });
    await prisma.order.update({ where: { id }, data: { carrier: label.carrier, trackingNumber: label.trackingNumber } });
    await audit({ action: "order.label_generated", adminId: ctx.admin.id, actorEmail: ctx.admin.email, entityType: "order", entityId: id, details: { publicCode: order.publicCode, ...label }, ip: ctx.ip });
    return NextResponse.json({ label });
  } catch (e) {
    if (e instanceof EnviaError) return NextResponse.json({ error: `Envia: ${e.message}` }, { status: 502 });
    return handleError(e);
  }
}
