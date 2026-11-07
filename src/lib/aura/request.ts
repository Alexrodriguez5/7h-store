import type { Customer, PrismaClient } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { createProductRequest, MAX_REQUEST_LINKS, MAX_REQUEST_PHOTOS } from "@/lib/services/product-requests";
import { UgcError } from "@/lib/ugc";
import { ipHash } from "./chat";
import { scanPrivate } from "./privacy";
import { draftArgs } from "./tools";

/**
 * Confirmación de una solicitud preparada por AURA. Aquí, y solo aquí, se juntan la identidad del cliente
 * (sesión verificada, en el servidor) y el borrador. El modelo nunca ve el correo ni el nombre.
 */
export const confirmInput = z.object({
  conversationId: z.string().trim().min(1).max(40),
  /** El cliente puede corregir el borrador en la tarjeta antes de confirmar. */
  draft: draftArgs,
  links: z.array(z.string().trim().max(500).regex(/^https?:\/\/[^\s<>"']+$/i, "Enlace no válido")).max(MAX_REQUEST_LINKS).default([]),
  consent: z.literal(true, { error: "Debes autorizar el uso de tus datos para responderte." }),
});
export type ConfirmInput = z.infer<typeof confirmInput>;

export class AuraRequestError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

export async function confirmAuraRequest(input: ConfirmInput, photos: Uint8Array[], viewer: { customer: Customer; ip: string }, db: PrismaClient = prisma) {
  const c = viewer.customer;
  if (!c.emailVerifiedAt) throw new AuraRequestError(403, "Primero verifica tu correo.");
  if (photos.length > MAX_REQUEST_PHOTOS) throw new AuraRequestError(400, `Adjunta máximo ${MAX_REQUEST_PHOTOS} fotos.`);

  const conv = await db.auraConversation.findUnique({ where: { id: input.conversationId }, select: { id: true, customerId: true, ipHash: true, status: true, draft: true, request: { select: { code: true } } } });
  // La conversación debe ser de este cliente, o de esta misma conexión si empezó sin sesión.
  if (!conv || (conv.customerId ? conv.customerId !== c.id : conv.ipHash !== ipHash(viewer.ip))) throw new AuraRequestError(404, "No encontramos esta conversación. Escríbele de nuevo a AURA.");
  if (conv.request) return { code: conv.request.code, duplicate: true, link: `/cuenta/busquedas/${conv.request.code}` };
  if (!conv.draft) throw new AuraRequestError(400, "AURA todavía no preparó una solicitud en esta conversación.");

  const d = input.draft;
  // El texto que corrigió el cliente pasa otra vez por el filtro de privacidad.
  const clean = (v: string | null) => (v ? scanPrivate(v).text : null);
  const pending = d.pendientes.filter((p) => !(p === "marca" && d.marca) && !(p === "modelo" && d.modelo) && !(p === "talla" && d.talla) && !(p === "color" && d.color) && !(p === "presupuesto" && d.presupuesto_cop != null));
  if (!photos.length && !input.links.length && !pending.includes("referencia_visual") && !d.modelo) pending.push("referencia_visual");

  try {
    const r = await createProductRequest(
      {
        name: (c.name?.trim() || c.email.split("@")[0]).slice(0, 80).padEnd(2, "."),
        email: c.email,
        phone: null,
        productName: clean(d.producto) ?? d.producto,
        brand: clean(d.marca), model: clean(d.modelo), color: clean(d.color), size: clean(d.talla), features: clean(d.caracteristicas), referenceStore: clean(d.tienda_referencia),
        url: null, links: input.links, budgetCOP: d.presupuesto_cop, comments: clean(d.resumen),
        source: "aura", consent: true, website: undefined,
      },
      photos,
      c.id,
      db,
      { summary: clean(d.resumen) ?? d.resumen, priority: d.prioridad, pending, conversationId: conv.id },
    );
    await db.auraConversation.update({ where: { id: conv.id }, data: { status: "solicitud", customerId: c.id, draft: undefined } });
    await db.auraMessage.create({ data: { conversationId: conv.id, role: "system", text: `Solicitud ${r.code} creada por confirmación del cliente.` } });
    return r;
  } catch (e) {
    if (e instanceof UgcError) throw new AuraRequestError(e.status, e.message);
    throw e;
  }
}
