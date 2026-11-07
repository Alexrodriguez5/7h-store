import { createHash, randomBytes } from "node:crypto";
import type { AlternativePriceKind, Prisma, PrismaClient, ProductRequestStatus } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { deliverLater, supportInbox } from "@/lib/mailer";
import { formatCOP } from "@/lib/format";
import { isAllowedImageUrl } from "@/lib/images";
import { textProblem } from "@/lib/ugc";

/**
 * Solicitudes especiales (CRM de AURA · Búsqueda personalizada).
 *
 * Reglas que protegen al negocio y al cliente:
 * - Precios, vigencias y condiciones los fija SOLO el equipo en el servidor; el navegador nunca los envía al aceptar.
 * - Las notas internas y lo confidencial del proveedor (`internalNotes`) nunca salen hacia el cliente.
 * - "Aceptar" no es una venta: la solicitud pasa a "Convertida en compra" solo cuando el pedido del checkout
 *   normal queda PAGADO (lo confirma Wompi o el pago manual verificado).
 * - Cada cambio queda en el historial (RequestEvent).
 */
export class RequestError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

const STATUS_LABEL: Partial<Record<ProductRequestStatus, string>> = {
  NUEVA: "Nueva solicitud", EN_REVISION: "En revisión", BUSCANDO_PROVEEDORES: "Buscando proveedores", COTIZANDO: "Cotizando",
  PROPUESTA_PREPARADA: "Propuesta preparada", PROPUESTA_ENVIADA: "Propuesta enviada", ESPERANDO_CLIENTE: "Esperando respuesta del cliente",
  ACEPTADA: "Aceptada", RECHAZADA: "Rechazada por el cliente", NO_DISPONIBLE: "No disponible", CONVERTIDA: "Convertida en compra", CERRADA: "Cerrada",
};

export const PRICE_KIND: Record<AlternativePriceKind, { label: string; customer: string }> = {
  ESTIMADO: { label: "Precio estimado", customer: "Precio estimado · puede cambiar al confirmar" },
  COTIZADO: { label: "Cotización confirmada", customer: "Cotización confirmada con el proveedor" },
  FINAL: { label: "Precio final de venta", customer: "Precio final de venta" },
};

// ── Acceso de invitados ────────────────────────────────────────────────

const hash = (t: string) => createHash("sha256").update(t).digest("hex");
export const ACCESS_DAYS = 30;

/** Enlace secreto (aleatorio, de un solo dueño, con vencimiento y revocable). Solo se guarda su hash. */
export async function issueAccessToken(requestId: string, db: PrismaClient = prisma, days = ACCESS_DAYS) {
  const token = randomBytes(24).toString("base64url");
  await db.requestAccessToken.create({ data: { requestId, tokenHash: hash(token), expiresAt: new Date(Date.now() + days * 86_400_000) } });
  return token;
}

export async function revokeAccessTokens(requestId: string, db: PrismaClient = prisma) {
  await db.requestAccessToken.updateMany({ where: { requestId, revokedAt: null }, data: { revokedAt: new Date() } });
}

/** ¿Este visitante puede ver la solicitud? Dueño con sesión y correo verificado, o enlace válido. */
export async function canAccess(req: { id: string; email: string; customerId: string | null }, viewer: { customer?: { id: string; email: string; emailVerifiedAt: Date | null } | null; token?: string | null }, db: PrismaClient = prisma) {
  const c = viewer.customer;
  if (c?.emailVerifiedAt && (req.customerId === c.id || req.email === c.email)) return true;
  if (!viewer.token || viewer.token.length > 100) return false;
  const row = await db.requestAccessToken.findUnique({ where: { tokenHash: hash(viewer.token) }, select: { requestId: true, expiresAt: true, revokedAt: true } });
  // La búsqueda es por el hash exacto del token: quien no lo tiene no puede adivinar el de otra solicitud.
  return !!row && row.requestId === req.id && !row.revokedAt && row.expiresAt > new Date();
}

// ── Lectura para el cliente (sin datos internos) ───────────────────────

export interface CustomerAlternative {
  id: string; round: number; name: string; brand: string | null; model: string | null; imageUrl: string | null; description: string | null;
  features: string[]; referenceUrl: string | null; priceKind: AlternativePriceKind; priceCOP: number | null; extraCostsCOP: number | null; shippingCOP: number | null;
  availability: string | null; deliveryEstimate: string | null; warranty: string | null; validUntil: string | null; notes: string | null;
  recommended: boolean; status: string; expired: boolean;
}

/** Lo que el cliente puede ver. Nunca incluye `internalNotes`, notas internas ni datos del equipo. */
export async function getCustomerView(code: string, db: PrismaClient = prisma) {
  const r = await db.productRequest.findUnique({
    where: { code },
    include: {
      images: { orderBy: { position: "asc" }, select: { id: true } },
      events: { where: { internal: false, kind: { in: ["message", "status", "proposal", "acceptance", "rejection", "offer"] } }, orderBy: { createdAt: "asc" }, select: { id: true, kind: true, body: true, authorType: true, toStatus: true, createdAt: true } },
      alternatives: { where: { status: { not: "BORRADOR" } }, orderBy: [{ round: "desc" }, { position: "asc" }] },
      offers: { where: { status: { in: ["ACTIVA", "USADA"] } }, orderBy: { createdAt: "desc" }, take: 1, include: { product: { select: { id: true, slug: true, name: true, brand: true, images: true, priceCOP: true, active: true } } } },
    },
  });
  if (!r) return null;
  const now = Date.now();
  const alternatives: CustomerAlternative[] = r.alternatives.map((a) => ({
    id: a.id, round: a.round, name: a.name, brand: a.brand, model: a.model, imageUrl: a.imageUrl, description: a.description, features: a.features, referenceUrl: a.referenceUrl,
    priceKind: a.priceKind, priceCOP: a.priceCOP, extraCostsCOP: a.extraCostsCOP, shippingCOP: a.shippingCOP, availability: a.availability, deliveryEstimate: a.deliveryEstimate,
    warranty: a.warranty, validUntil: a.validUntil?.toISOString() ?? null, notes: a.notes, recommended: a.recommended, status: a.status,
    expired: !!a.validUntil && a.validUntil.getTime() < now,
  }));
  const offer = r.offers[0];
  return {
    id: r.id, code: r.code, email: r.email, customerId: r.customerId, name: r.name, status: r.status, createdAt: r.createdAt.toISOString(), updatedAt: r.updatedAt.toISOString(),
    productName: r.productName, brand: r.brand, model: r.model, color: r.color, size: r.size, features: r.features, referenceStore: r.referenceStore,
    budgetCOP: r.budgetCOP, comments: r.comments, links: r.links, imageIds: r.images.map((i) => i.id), legacyImage: !!r.imagePath,
    events: r.events.map((e) => ({ ...e, createdAt: e.createdAt.toISOString() })),
    alternatives,
    offer: offer
      ? { id: offer.id, status: offer.status, expiresAt: offer.expiresAt.toISOString(), expired: offer.expiresAt.getTime() < now, priceCOP: offer.priceCOP, product: offer.product }
      : null,
  };
}
export type CustomerView = NonNullable<Awaited<ReturnType<typeof getCustomerView>>>;

// ── Acciones del cliente ───────────────────────────────────────────────

export const customerActionInput = z.discriminatedUnion("action", [
  z.object({ action: z.literal("message"), body: z.string().trim().min(2, "Escribe tu mensaje").max(2000) }),
  z.object({ action: z.literal("accept"), alternativeId: z.string().min(1).max(40), body: z.string().trim().max(1000).optional() }),
  z.object({ action: z.literal("reject"), body: z.string().trim().max(1000).optional() }),
]);
export type CustomerAction = z.infer<typeof customerActionInput>;

function staffMail(code: string, subject: string, paragraphs: string[]) {
  const inbox = supportInbox();
  if (inbox) deliverLater({ to: inbox, kind: "product_request.staff", ref: code, subject: `[${code}] ${subject}`, heading: subject, paragraphs, cta: { label: "Abrir en el panel", path: `/admin/solicitudes-especiales/${code}` } });
}

/**
 * El cliente pregunta, acepta una alternativa o rechaza la propuesta.
 * Aceptar solo REGISTRA la decisión: el equipo confirma vigencia, precio y disponibilidad y prepara la oferta.
 */
export async function customerAct(requestId: string, action: CustomerAction, db: PrismaClient = prisma) {
  const r = await db.productRequest.findUnique({ where: { id: requestId }, select: { id: true, code: true, status: true, productName: true, name: true, email: true } });
  if (!r) throw new RequestError(404, "Solicitud no encontrada.");
  if (["CERRADA", "CONVERTIDA", "NO_DISPONIBLE", "FINALIZADA"].includes(r.status)) throw new RequestError(400, "Esta solicitud ya está cerrada. Puedes crear una nueva cuando quieras.");
  if (action.body) {
    const p = textProblem(action.body);
    if (p && !p.includes("enlaces")) throw new RequestError(400, p);
  }

  if (action.action === "message") {
    await db.requestEvent.create({ data: { requestId, kind: "message", body: action.body, authorType: "customer" } });
    await db.productRequest.update({ where: { id: requestId }, data: { updatedAt: new Date() } });
    staffMail(r.code, "Nuevo mensaje del cliente", [`${r.name} <${r.email}>`, action.body.slice(0, 1500)]);
    return { ok: true };
  }

  if (action.action === "accept") {
    const alt = await db.requestAlternative.findFirst({ where: { id: action.alternativeId, requestId, status: "ENVIADA" } });
    if (!alt) throw new RequestError(400, "Esa alternativa ya no está disponible.");
    if (alt.validUntil && alt.validUntil < new Date()) throw new RequestError(400, "La vigencia de esta alternativa terminó. Escríbenos y la actualizamos.");
    await db.$transaction([
      db.requestAlternative.update({ where: { id: alt.id }, data: { status: "ACEPTADA", respondedAt: new Date() } }),
      db.productRequest.update({ where: { id: requestId }, data: { status: "ACEPTADA" } }),
      db.requestEvent.create({ data: { requestId, kind: "acceptance", fromStatus: r.status, toStatus: "ACEPTADA", body: `Aceptó «${alt.name}».${action.body ? ` ${action.body}` : ""}`, authorType: "customer" } }),
    ]);
    staffMail(r.code, "El cliente aceptó una alternativa", [`Alternativa: ${alt.name}`, `${PRICE_KIND[alt.priceKind].label}: ${alt.priceCOP ? formatCOP(alt.priceCOP) : "—"}`, "Confirma vigencia, precio y disponibilidad y prepara la oferta de compra."]);
    deliverLater({
      to: r.email, kind: "product_request.accepted", ref: r.code, subject: `Recibimos tu elección · ${r.code}`, heading: "Elegiste una alternativa",
      paragraphs: [`Hola ${r.name.split(" ")[0]}, registramos que elegiste «${alt.name}».`, "Antes de cobrar nada confirmamos de nuevo precio, disponibilidad y tiempos. Te avisaremos cuando tu oferta de compra esté lista."],
    });
    return { ok: true };
  }

  await db.$transaction([
    db.requestAlternative.updateMany({ where: { requestId, status: "ENVIADA" }, data: { status: "RECHAZADA", respondedAt: new Date() } }),
    db.productRequest.update({ where: { id: requestId }, data: { status: "RECHAZADA", closeReason: action.body || "El cliente rechazó la propuesta" } }),
    db.requestEvent.create({ data: { requestId, kind: "rejection", fromStatus: r.status, toStatus: "RECHAZADA", body: action.body || "El cliente indicó que ninguna alternativa le sirve.", authorType: "customer" } }),
  ]);
  staffMail(r.code, "El cliente rechazó la propuesta", [action.body || "Sin comentarios."]);
  return { ok: true };
}

// ── Acciones del equipo ────────────────────────────────────────────────

/** Avisos al cliente en los cambios de estado que le importan (los demás quedan solo en el historial). */
const NOTIFY: Partial<Record<ProductRequestStatus, (product: string) => { subject: string; text: string }>> = {
  EN_REVISION: (p) => ({ subject: "Tu solicitud está en revisión", text: `Ya estamos revisando tu búsqueda de «${p}».` }),
  NO_DISPONIBLE: (p) => ({ subject: "Sobre tu solicitud", text: `Por ahora no podemos conseguir «${p}». Gracias por confiar en nosotros; puedes enviarnos otra búsqueda cuando quieras.` }),
  CERRADA: (p) => ({ subject: "Tu solicitud se cerró", text: `Cerramos tu solicitud de «${p}». Si necesitas algo más, crea una nueva.` }),
};

async function customerLink(r: { id: string; code: string; customerId: string | null }, db: PrismaClient) {
  return r.customerId ? `/cuenta/busquedas/${r.code}` : `/busqueda/${r.code}?t=${await issueAccessToken(r.id, db)}`;
}

export async function changeStatus(id: string, to: ProductRequestStatus, adminId: string, note: string | null, db: PrismaClient = prisma) {
  const r = await db.productRequest.findUnique({ where: { id }, select: { id: true, code: true, status: true, productName: true, name: true, email: true, customerId: true, firstResponseAt: true } });
  if (!r) throw new RequestError(404, "Solicitud no encontrada.");
  if (r.status === to) return r;
  if (to === "CONVERTIDA") throw new RequestError(400, "«Convertida en compra» se marca sola cuando el pedido queda pagado.");
  await db.$transaction([
    db.productRequest.update({ where: { id }, data: { status: to, ...(to === "NO_DISPONIBLE" || to === "CERRADA" ? { closeReason: note } : {}), ...(!r.firstResponseAt ? { firstResponseAt: new Date() } : {}) } }),
    db.requestEvent.create({ data: { requestId: id, kind: "status", fromStatus: r.status, toStatus: to, body: note, internal: false, authorType: "admin", adminId } }),
  ]);
  const n = NOTIFY[to]?.(r.productName);
  if (n) {
    deliverLater({
      to: r.email, kind: `product_request.${to.toLowerCase()}`, ref: r.code, subject: `${n.subject} · ${r.code}`, heading: n.subject,
      paragraphs: [`Hola ${r.name.split(" ")[0]},`, n.text, ...(note ? [note] : [])], cta: { label: "Ver mi solicitud", path: await customerLink(r, db) },
    });
  }
  return r;
}

export async function addNote(id: string, adminId: string, body: string, db: PrismaClient = prisma) {
  await db.requestEvent.create({ data: { requestId: id, kind: "note", body, internal: true, authorType: "admin", adminId } });
}

/** Respuesta personal del equipo: queda en la conversación y llega al cliente por correo. */
export async function adminMessage(id: string, adminId: string, body: string, db: PrismaClient = prisma) {
  const r = await db.productRequest.findUnique({ where: { id }, select: { id: true, code: true, productName: true, name: true, email: true, customerId: true, firstResponseAt: true } });
  if (!r) throw new RequestError(404, "Solicitud no encontrada.");
  await db.$transaction([
    db.requestEvent.create({ data: { requestId: id, kind: "message", body, authorType: "admin", adminId } }),
    db.productRequest.update({ where: { id }, data: { adminReply: body, repliedAt: new Date(), ...(!r.firstResponseAt ? { firstResponseAt: new Date() } : {}) } }),
  ]);
  deliverLater({
    to: r.email, kind: "product_request.reply", ref: r.code, subject: `Nueva respuesta sobre tu solicitud ${r.code}`, heading: `Sobre «${r.productName}»`,
    paragraphs: [`Hola ${r.name.split(" ")[0]}, te respondimos:`, body.slice(0, 1800)], cta: { label: "Ver la conversación", path: await customerLink(r, db) },
  });
}

export const structuredInput = z.object({
  productName: z.string().trim().min(2).max(160),
  brand: z.string().trim().max(60).nullable(),
  model: z.string().trim().max(80).nullable(),
  color: z.string().trim().max(60).nullable(),
  size: z.string().trim().max(40).nullable(),
  features: z.string().trim().max(600).nullable(),
  referenceStore: z.string().trim().max(120).nullable(),
  budgetCOP: z.number().int().min(0).max(200_000_000).nullable(),
  phone: z.string().trim().max(30).nullable(),
});

/** Edita los campos estructurados. La descripción original del cliente (`originalText`) nunca cambia. */
export async function editStructured(id: string, adminId: string, data: z.infer<typeof structuredInput>, db: PrismaClient = prisma) {
  const clean = Object.fromEntries(Object.entries(data).map(([k, v]) => [k, typeof v === "string" && v === "" ? null : v]));
  await db.$transaction([
    db.productRequest.update({ where: { id }, data: clean }),
    db.requestEvent.create({ data: { requestId: id, kind: "edit", body: "El equipo actualizó la información estructurada.", internal: true, authorType: "admin", adminId } }),
  ]);
}

export async function assign(id: string, adminId: string, assignee: string | null, db: PrismaClient = prisma) {
  const who = assignee ? await db.adminUser.findUnique({ where: { id: assignee }, select: { name: true } }) : null;
  if (assignee && !who) throw new RequestError(400, "Responsable no válido.");
  await db.$transaction([
    db.productRequest.update({ where: { id }, data: { assignedAdminId: assignee } }),
    db.requestEvent.create({ data: { requestId: id, kind: "assign", body: who ? `Responsable: ${who.name}` : "Sin responsable", internal: true, authorType: "admin", adminId } }),
  ]);
}

// ── Alternativas ───────────────────────────────────────────────────────

const money = z.number().int().min(0).max(500_000_000).nullable();
const text = (max: number) => z.string().trim().max(max).nullable();
export const alternativeInput = z.object({
  name: z.string().trim().min(2, "Nombre del producto").max(160),
  brand: text(60), model: text(80),
  imageUrl: z.string().trim().max(600).nullable().refine((v) => !v || isAllowedImageUrl(v), "Imagen no válida: súbela a la tienda o usa una URL permitida"),
  description: text(2000),
  features: z.array(z.string().trim().min(1).max(160)).max(15).default([]),
  referenceUrl: z.string().trim().max(500).nullable().refine((v) => !v || /^https?:\/\/[^\s<>"']+$/i.test(v), "Enlace no válido"),
  priceKind: z.enum(["ESTIMADO", "COTIZADO", "FINAL"]),
  priceCOP: money, extraCostsCOP: money, shippingCOP: money,
  availability: text(160), deliveryEstimate: text(120), warranty: text(400),
  validUntil: z.string().nullable().refine((v) => !v || !Number.isNaN(Date.parse(v)), "Fecha no válida"),
  notes: text(1000), internalNotes: text(2000),
  recommended: z.boolean().default(false),
});
export type AlternativeInput = z.infer<typeof alternativeInput>;

const altData = (a: AlternativeInput) => ({ ...a, validUntil: a.validUntil ? new Date(`${a.validUntil.slice(0, 10)}T23:59:59-05:00`) : null });

export async function saveAlternative(requestId: string, adminId: string, input: AlternativeInput, alternativeId: string | null, db: PrismaClient = prisma) {
  const r = await db.productRequest.findUnique({ where: { id: requestId }, select: { status: true, alternatives: { select: { round: true, status: true }, orderBy: { round: "desc" }, take: 1 } } });
  if (!r) throw new RequestError(404, "Solicitud no encontrada.");
  return db.$transaction(async (tx) => {
    if (input.recommended) await tx.requestAlternative.updateMany({ where: { requestId, status: "BORRADOR" }, data: { recommended: false } });
    if (alternativeId) {
      const cur = await tx.requestAlternative.findFirst({ where: { id: alternativeId, requestId } });
      if (!cur) throw new RequestError(404, "Alternativa no encontrada.");
      if (cur.status !== "BORRADOR") throw new RequestError(400, "Esta alternativa ya se envió. Crea una nueva revisión para cambiarla.");
      return tx.requestAlternative.update({ where: { id: alternativeId }, data: altData(input) });
    }
    // Nueva revisión: si la última ronda ya se envió, la nueva alternativa abre la siguiente ronda.
    const last = r.alternatives[0];
    const round = !last ? 1 : last.status === "BORRADOR" ? last.round : last.round + 1;
    const position = await tx.requestAlternative.count({ where: { requestId, round } });
    const alt = await tx.requestAlternative.create({ data: { ...altData(input), requestId, round, position } });
    await tx.requestEvent.create({ data: { requestId, kind: "edit", body: `Alternativa preparada: ${input.name}`, internal: true, authorType: "admin", adminId } });
    if (["NUEVA", "EN_REVISION", "BUSCANDO_PROVEEDORES", "COTIZANDO"].includes(r.status)) {
      await tx.productRequest.update({ where: { id: requestId }, data: { status: "PROPUESTA_PREPARADA" } });
      await tx.requestEvent.create({ data: { requestId, kind: "status", fromStatus: r.status, toStatus: "PROPUESTA_PREPARADA", authorType: "admin", adminId } });
    }
    return alt;
  });
}

export async function deleteAlternative(requestId: string, alternativeId: string, db: PrismaClient = prisma) {
  const cur = await db.requestAlternative.findFirst({ where: { id: alternativeId, requestId } });
  if (!cur) throw new RequestError(404, "Alternativa no encontrada.");
  if (cur.status !== "BORRADOR") throw new RequestError(400, "No se puede borrar una alternativa que ya vio el cliente.");
  await db.requestAlternative.delete({ where: { id: alternativeId } });
}

/** Envía al cliente las alternativas en borrador (una "ronda" de propuesta). */
export async function sendProposal(requestId: string, adminId: string, message: string | null, db: PrismaClient = prisma) {
  const r = await db.productRequest.findUnique({ where: { id: requestId }, select: { id: true, code: true, status: true, productName: true, name: true, email: true, customerId: true, firstResponseAt: true } });
  if (!r) throw new RequestError(404, "Solicitud no encontrada.");
  const drafts = await db.requestAlternative.findMany({ where: { requestId, status: "BORRADOR" } });
  if (!drafts.length) throw new RequestError(400, "Prepara al menos una alternativa antes de enviar la propuesta.");
  const missing = drafts.find((d) => d.priceCOP == null);
  if (missing) throw new RequestError(400, `Falta el precio de «${missing.name}» (puede ser estimado).`);
  const now = new Date();
  await db.$transaction([
    db.requestAlternative.updateMany({ where: { requestId, status: "BORRADOR" }, data: { status: "ENVIADA", sentAt: now } }),
    db.productRequest.update({ where: { id: requestId }, data: { status: "ESPERANDO_CLIENTE", ...(!r.firstResponseAt ? { firstResponseAt: now } : {}) } }),
    db.requestEvent.create({ data: { requestId, kind: "proposal", fromStatus: r.status, toStatus: "PROPUESTA_ENVIADA", body: message || `Te enviamos ${drafts.length} ${drafts.length === 1 ? "alternativa" : "alternativas"}.`, authorType: "admin", adminId } }),
    db.requestEvent.create({ data: { requestId, kind: "status", fromStatus: "PROPUESTA_ENVIADA", toStatus: "ESPERANDO_CLIENTE", authorType: "system" } }),
  ]);
  deliverLater({
    to: r.email, kind: "product_request.proposal", ref: r.code, subject: `Tenemos alternativas para ti · ${r.code}`, heading: `Sobre «${r.productName}»`,
    paragraphs: [`Hola ${r.name.split(" ")[0]}, preparamos ${drafts.length} ${drafts.length === 1 ? "alternativa" : "alternativas"} para tu búsqueda.`, ...(message ? [message] : []), "Revisa precios, tiempos y condiciones. Puedes elegir una, hacernos preguntas o decirnos que ninguna te sirve. Nada se cobra hasta que confirmemos tu oferta de compra."],
    cta: { label: "Ver la propuesta", path: await customerLink(r, db) },
  });
}

// ── Oferta de compra (producto privado + checkout normal) ──────────────

export const offerInput = z.object({
  alternativeId: z.string().min(1).max(40),
  priceCOP: z.number().int().positive().max(500_000_000),
  category: z.string().trim().min(1).max(40),
  hours: z.number().int().min(1).max(24 * 14).default(72),
  weightGrams: z.number().int().min(1).max(100_000).nullable().optional(),
});

/**
 * Prepara la oferta de compra de una alternativa ACEPTADA: crea un producto privado (no sale en el catálogo),
 * con el precio FINAL que fija el equipo, 1 unidad y vencimiento. Solo el correo de la solicitud puede comprarlo.
 */
export async function prepareOffer(requestId: string, adminId: string, input: z.infer<typeof offerInput>, db: PrismaClient = prisma) {
  const r = await db.productRequest.findUnique({ where: { id: requestId }, select: { id: true, code: true, email: true, name: true, customerId: true, productName: true } });
  if (!r) throw new RequestError(404, "Solicitud no encontrada.");
  const alt = await db.requestAlternative.findFirst({ where: { id: input.alternativeId, requestId, status: "ACEPTADA" } });
  if (!alt) throw new RequestError(400, "Solo se prepara la oferta de una alternativa que el cliente aceptó.");
  if (alt.validUntil && alt.validUntil < new Date()) throw new RequestError(400, "La vigencia de la cotización terminó: confirma de nuevo con el proveedor y actualiza la vigencia.");
  const category = await db.category.findUnique({ where: { slug: input.category }, select: { id: true } });
  if (!category) throw new RequestError(400, "Categoría no válida.");
  if (!alt.imageUrl) throw new RequestError(400, "Agrega una foto a la alternativa antes de preparar la oferta.");
  const expiresAt = new Date(Date.now() + input.hours * 3_600_000);

  return db.$transaction(async (tx) => {
    // Una sola oferta activa por solicitud: la anterior se revoca y su producto se desactiva.
    const prev = await tx.customOffer.findMany({ where: { requestId, status: "ACTIVA" }, select: { id: true, productId: true } });
    for (const p of prev) {
      await tx.customOffer.update({ where: { id: p.id }, data: { status: "REVOCADA" } });
      await tx.product.update({ where: { id: p.productId }, data: { active: false } });
    }
    const product = await tx.product.create({
      data: {
        slug: `oferta-${r.code.toLowerCase()}-${randomBytes(3).toString("hex")}`,
        name: alt.name, brand: alt.brand || "7H STORE",
        description: [alt.description, alt.features.length ? `Características: ${alt.features.join(" · ")}` : null, alt.warranty ? `Garantía: ${alt.warranty}` : null, `Oferta personalizada de la solicitud ${r.code}.`].filter(Boolean).join("\n\n"),
        priceCOP: input.priceCOP, categoryId: category.id, gender: "UNISEX", images: [alt.imageUrl!], sizes: [], stock: 1, tags: [], featured: false,
        active: true, customOnly: true, model: alt.model, warranty: alt.warranty, features: alt.features, weightGrams: input.weightGrams ?? null,
      },
      select: { id: true, slug: true },
    });
    const offer = await tx.customOffer.create({ data: { requestId, alternativeId: alt.id, productId: product.id, customerEmail: r.email, priceCOP: input.priceCOP, expiresAt } });
    await tx.requestAlternative.update({ where: { id: alt.id }, data: { priceKind: "FINAL", priceCOP: input.priceCOP } });
    await tx.requestEvent.create({ data: { requestId, kind: "offer", body: `Tu oferta de compra está lista: ${alt.name} por ${formatCOP(input.priceCOP)}. Vence el ${expiresAt.toLocaleString("es-CO", { timeZone: "America/Bogota" })}.`, authorType: "admin", adminId } });
    const link = r.customerId ? `/cuenta/busquedas/${r.code}` : `/busqueda/${r.code}?t=${await issueAccessToken(r.id, tx as unknown as PrismaClient)}`;
    deliverLater({
      to: r.email, kind: "product_request.offer", ref: r.code, subject: `Tu oferta de compra está lista · ${r.code}`, heading: "Tu oferta está lista",
      paragraphs: [`Hola ${r.name.split(" ")[0]}, confirmamos «${alt.name}» por ${formatCOP(input.priceCOP)} (precio final de venta).`, `La oferta es solo para ti y vence el ${expiresAt.toLocaleString("es-CO", { timeZone: "America/Bogota" })}. Pagas por el checkout de siempre, con el mismo correo de esta solicitud.`],
      cta: { label: "Comprar ahora", path: link },
    });
    return { offerId: offer.id, productSlug: product.slug };
  });
}

/**
 * Regla del checkout para productos de ofertas personalizadas (la llama `createOrder`):
 * solo el correo dueño de la oferta, oferta ACTIVA y vigente, 1 unidad, y sin otro pedido pagado o pendiente.
 */
export async function assertCustomOfferPurchase(tx: Prisma.TransactionClient, productId: string, email: string, quantity: number) {
  const offer = await tx.customOffer.findUnique({ where: { productId }, select: { id: true, status: true, expiresAt: true, customerEmail: true, orderId: true } });
  if (!offer || offer.status !== "ACTIVA" || offer.expiresAt < new Date()) throw new Error("CUSTOM_OFFER_UNAVAILABLE");
  if (offer.customerEmail.toLowerCase() !== email.trim().toLowerCase()) throw new Error("CUSTOM_OFFER_OWNER");
  if (quantity !== 1) throw new Error("CUSTOM_OFFER_QUANTITY");
  if (offer.orderId) {
    const prev = await tx.order.findUnique({ where: { id: offer.orderId }, select: { status: true } });
    if (prev && !["CANCELLED", "EXPIRED"].includes(prev.status)) throw new Error("CUSTOM_OFFER_IN_USE");
  }
  return offer.id;
}

/**
 * Concilia ofertas con pedidos (no toca Wompi ni los pagos): pedido pagado → oferta USADA y solicitud
 * CONVERTIDA; oferta vencida sin pago → VENCIDA y su producto se desactiva.
 */
export async function syncOffers(db: PrismaClient = prisma) {
  const now = new Date();
  const active = await db.customOffer.findMany({ where: { status: "ACTIVA" }, select: { id: true, requestId: true, productId: true, orderId: true, expiresAt: true } });
  for (const o of active) {
    const order = o.orderId ? await db.order.findUnique({ where: { id: o.orderId }, select: { status: true, publicCode: true } }) : null;
    if (order && ["PAID", "PROCESSING", "SHIPPED", "DELIVERED"].includes(order.status)) {
      const req = await db.productRequest.findUnique({ where: { id: o.requestId }, select: { status: true } });
      await db.$transaction([
        db.customOffer.update({ where: { id: o.id }, data: { status: "USADA" } }),
        db.productRequest.update({ where: { id: o.requestId }, data: { status: "CONVERTIDA" } }),
        db.requestEvent.create({ data: { requestId: o.requestId, kind: "status", fromStatus: req?.status ?? null, toStatus: "CONVERTIDA", body: `Compra confirmada: pedido ${order.publicCode}.`, authorType: "system" } }),
      ]);
    } else if (o.expiresAt < now && !(order && order.status === "PENDING_PAYMENT")) {
      await db.$transaction([
        db.customOffer.update({ where: { id: o.id }, data: { status: "VENCIDA" } }),
        db.product.update({ where: { id: o.productId }, data: { active: false } }),
        db.requestEvent.create({ data: { requestId: o.requestId, kind: "offer", body: "La oferta de compra venció sin pago.", authorType: "system" } }),
      ]);
    }
  }
}

/** Avisa al cliente cuando una alternativa enviada vence en menos de 48 horas (lo corre el cron diario). */
export async function remindExpiringQuotes(db: PrismaClient = prisma) {
  const soon = new Date(Date.now() + 48 * 3_600_000);
  const alts = await db.requestAlternative.findMany({
    where: { status: "ENVIADA", validUntil: { gt: new Date(), lte: soon }, request: { status: "ESPERANDO_CLIENTE" } },
    select: { id: true, name: true, validUntil: true, requestId: true, request: { select: { id: true, code: true, email: true, name: true, customerId: true, events: { where: { kind: "reminder" }, select: { body: true } } } } },
  });
  let sent = 0;
  for (const a of alts) {
    if (a.request.events.some((e) => e.body === a.id)) continue; // ya se avisó por esta alternativa
    await db.requestEvent.create({ data: { requestId: a.requestId, kind: "reminder", body: a.id, internal: true, authorType: "system" } });
    deliverLater({
      to: a.request.email, kind: "product_request.expiring", ref: a.request.code, subject: `Tu cotización vence pronto · ${a.request.code}`, heading: "Tu cotización vence pronto",
      paragraphs: [`Hola ${a.request.name.split(" ")[0]}, la alternativa «${a.name}» vence el ${a.validUntil!.toLocaleDateString("es-CO", { timeZone: "America/Bogota" })}.`, "Después de esa fecha tendríamos que confirmar de nuevo el precio y la disponibilidad."],
      cta: { label: "Ver la propuesta", path: await customerLink(a.request, db) },
    });
    sent++;
  }
  return sent;
}

export { STATUS_LABEL };
