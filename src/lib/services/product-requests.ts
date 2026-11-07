import { randomBytes } from "node:crypto";
import type { PrismaClient, ProductRequestStatus } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { deliverLater, supportInbox } from "@/lib/mailer";
import { UgcError, deleteUgcPhotos, textProblem, uploadUgcPhoto } from "@/lib/ugc";
import { issueAccessToken } from "@/lib/services/special-requests";

/**
 * AURA · Búsqueda personalizada ("Tú lo buscas. Nosotros lo exploramos").
 * Estados del flujo, en orden, con su texto para el equipo y para el cliente.
 * DISPONIBLE y FINALIZADA son estados antiguos: se conservan para no romper solicitudes existentes.
 */
export const REQUEST_STATUS: Record<ProductRequestStatus, { label: string; customer: string; legacy?: true }> = {
  NUEVA: { label: "Nueva solicitud", customer: "Recibimos tu solicitud." },
  EN_REVISION: { label: "En revisión", customer: "Estamos revisando tu solicitud." },
  BUSCANDO_PROVEEDORES: { label: "Buscando proveedores", customer: "Estamos buscando dónde conseguirlo." },
  COTIZANDO: { label: "Cotizando", customer: "Estamos consultando disponibilidad y precio." },
  PROPUESTA_PREPARADA: { label: "Propuesta preparada", customer: "Estamos preparando tu propuesta." },
  PROPUESTA_ENVIADA: { label: "Propuesta enviada", customer: "Te enviamos alternativas. Revísalas cuando quieras." },
  ESPERANDO_CLIENTE: { label: "Esperando respuesta del cliente", customer: "Tienes una propuesta esperando tu respuesta." },
  ACEPTADA: { label: "Aceptada", customer: "Aceptaste una alternativa. Estamos preparando tu oferta de compra." },
  RECHAZADA: { label: "Rechazada por el cliente", customer: "Indicaste que ninguna alternativa te sirve." },
  NO_DISPONIBLE: { label: "No disponible", customer: "Por ahora no podemos conseguir este producto." },
  CONVERTIDA: { label: "Convertida en compra", customer: "¡Compra confirmada! Sigue tu pedido en Mi cuenta." },
  CERRADA: { label: "Cerrada", customer: "Tu solicitud está cerrada." },
  DISPONIBLE: { label: "Disponible para ofrecer", customer: "¡Podemos conseguirlo! Te contamos los detalles.", legacy: true },
  FINALIZADA: { label: "Finalizada", customer: "Tu solicitud está cerrada.", legacy: true },
};
/** Los 12 estados del flujo (sin los antiguos), en el orden en que avanza una solicitud. */
export const REQUEST_STATUS_ORDER = (Object.keys(REQUEST_STATUS) as ProductRequestStatus[]).filter((s) => !REQUEST_STATUS[s].legacy);
export const OPEN_STATUSES: ProductRequestStatus[] = ["NUEVA", "EN_REVISION", "BUSCANDO_PROVEEDORES", "COTIZANDO", "PROPUESTA_PREPARADA", "PROPUESTA_ENVIADA", "ESPERANDO_CLIENTE", "ACEPTADA", "DISPONIBLE"];

export const MAX_REQUEST_PHOTOS = 4;
export const MAX_REQUEST_LINKS = 5;

const optional = (max: number) => z.string().trim().max(max).optional().or(z.literal("")).transform((v) => v || null);
const httpsUrl = z.string().trim().max(500).refine((v) => /^https?:\/\/[^\s<>"']+$/i.test(v), "Enlace no válido");

/** Todo es opcional salvo cómo responderte y qué buscas (aunque sea en palabras propias). */
export const productRequestInput = z.object({
  name: z.string().trim().min(2, "Escribe tu nombre").max(80),
  email: z.string().trim().toLowerCase().max(254).pipe(z.email("Correo no válido")),
  phone: z.string().trim().regex(/^\+?\d[\d\s-]{6,18}$/, "Teléfono no válido").optional().or(z.literal("")).transform((v) => v || null),
  productName: z.string().trim().min(2, "Cuéntanos qué producto buscas").max(160),
  brand: optional(60),
  model: optional(80),
  color: optional(60),
  size: optional(40),
  features: optional(600),
  referenceStore: optional(120),
  url: httpsUrl.optional().or(z.literal("")).transform((v) => v || null),
  links: z.array(httpsUrl).max(MAX_REQUEST_LINKS, `Máximo ${MAX_REQUEST_LINKS} enlaces`).default([]),
  budgetCOP: z.number().int().min(0).max(200_000_000).nullable().optional(),
  comments: optional(2000),
  source: z.enum(["formulario", "asistente", "cuenta", "portada", "aura"]).default("formulario"),
  /** Autorización para usar el correo solo para responder la solicitud (Ley 1581). */
  consent: z.literal(true, { error: "Debes autorizar el uso de tus datos para responderte." }),
  website: z.string().max(200).optional(),
});
export type ProductRequestInput = z.infer<typeof productRequestInput>;

/** Alfabeto sin caracteres que se confunden al dictarlos o leerlos (0/O, 1/I/L). 31 símbolos. */
export const CODE_ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";

/** 6 símbolos aleatorios con generador criptográfico y sin sesgo de módulo (rechazo de bytes ≥ 248). */
export function randomRequestCode(rand: (n: number) => Uint8Array = (n) => randomBytes(n)) {
  let out = "";
  while (out.length < 6) {
    for (const b of rand(12)) {
      if (b >= 248) continue; // 248 = 31 × 8: así cada símbolo tiene la misma probabilidad
      out += CODE_ALPHABET[b % 31];
      if (out.length === 6) break;
    }
  }
  return `BUS-${out}`;
}

/** Código público nuevo (BUS-A83K2F). Los históricos (BUS-AAAA-000001) se conservan tal cual. */
async function nextCode(db: PrismaClient) {
  for (let i = 0; i < 8; i++) {
    const code = randomRequestCode();
    if (!(await db.productRequest.findUnique({ where: { code }, select: { id: true } }))) return code;
  }
  throw new Error("REQUEST_CODE_EXHAUSTED");
}

/** Texto original del cliente, tal como lo envió (el equipo puede editar los campos, nunca esto). */
function originalTextOf(i: ProductRequestInput) {
  return [
    `Producto: ${i.productName}`,
    i.brand && `Marca: ${i.brand}`,
    i.model && `Modelo: ${i.model}`,
    i.color && `Color: ${i.color}`,
    i.size && `Talla: ${i.size}`,
    i.features && `Características: ${i.features}`,
    i.referenceStore && `Tienda o país de referencia: ${i.referenceStore}`,
    i.budgetCOP != null && `Presupuesto aproximado: ${i.budgetCOP} COP`,
    i.comments && `Comentarios: ${i.comments}`,
  ].filter(Boolean).join("\n");
}

/**
 * Registra la solicitud (fotos en el bucket privado), evita duplicados recientes y avisa al equipo y al cliente.
 * Devuelve el radicado y, si no hay sesión, el enlace seguro para seguirla.
 */
/** Datos que AURA agrega a una solicitud creada desde el chat (sin datos personales). */
export interface AuraRequestExtra { summary: string; priority: "alta" | "normal" | "baja"; pending: string[]; conversationId: string }

export async function createProductRequest(input: ProductRequestInput, photos: Uint8Array[], customerId: string | null, db: PrismaClient = prisma, aura?: AuraRequestExtra) {
  if (input.website) throw new UgcError(400, "No pudimos enviar tu solicitud.");
  for (const t of [input.productName, input.comments ?? "", input.brand ?? "", input.model ?? "", input.features ?? ""]) {
    const p = textProblem(t);
    if (p && !p.includes("enlaces")) throw new UgcError(400, p);
  }
  if (photos.length > MAX_REQUEST_PHOTOS) throw new UgcError(400, `Puedes adjuntar hasta ${MAX_REQUEST_PHOTOS} fotos.`);

  // Duplicado: mismo correo y mismo producto en las últimas 24 h → se devuelve la solicitud existente.
  const dup = await db.productRequest.findFirst({
    where: { email: input.email, productName: { equals: input.productName, mode: "insensitive" }, createdAt: { gte: new Date(Date.now() - 86_400_000) } },
    select: { id: true, code: true },
  });
  if (dup) return { code: dup.code, duplicate: true, link: null as string | null };

  const uploaded: { path: string; mime: string }[] = [];
  try {
    for (const p of photos) uploaded.push(await uploadUgcPhoto("solicitudes", p));
    const code = await nextCode(db);
    const links = [...new Set([input.url, ...input.links].filter((l): l is string => !!l))].slice(0, MAX_REQUEST_LINKS);
    const r = await db.productRequest.create({
      data: {
        code, customerId, name: input.name, email: input.email, phone: input.phone, productName: input.productName, brand: input.brand, model: input.model,
        color: input.color, size: input.size, features: input.features, referenceStore: input.referenceStore,
        url: links[0] ?? null, links, budgetCOP: input.budgetCOP ?? null, comments: input.comments, source: input.source,
        originalText: originalTextOf(input),
        ...(aura ? { auraSummary: aura.summary, auraPriority: aura.priority, auraPending: aura.pending, auraConversationId: aura.conversationId } : {}),
        images: { create: uploaded.map((u, i) => ({ ...u, position: i })) },
        events: { create: { kind: "status", toStatus: "NUEVA", authorType: "customer", body: "Solicitud creada." } },
      },
      select: { id: true, code: true },
    });
    const token = customerId ? null : await issueAccessToken(r.id, db);
    const link = token ? `/busqueda/${r.code}?t=${token}` : `/cuenta/busquedas/${r.code}`;
    deliverLater({
      to: input.email, kind: "product_request.created", ref: r.code, subject: `Recibimos tu solicitud ${r.code}`, heading: "Tú lo necesitas. Nosotros buscamos cómo conseguirlo.",
      paragraphs: [`Hola ${input.name.split(" ")[0]}, recibimos tu solicitud de «${input.productName}».`, "Nuestro equipo revisará la información y preparará posibles alternativas para ti. No todos los productos se pueden conseguir, pero revisamos cada solicitud y te responderemos con honestidad.", `Tu número de seguimiento es ${r.code}.`],
      cta: { label: "Ver mi solicitud", path: link },
    });
    const inbox = supportInbox();
    if (inbox) {
      deliverLater({
        to: inbox, kind: "product_request.staff", ref: r.code, subject: `[${r.code}] Nueva búsqueda: ${input.productName.slice(0, 60)}`, heading: "Nueva solicitud especial",
        // Aviso mínimo: sin correo, teléfono ni archivos (todo eso se ve en el panel, con sesión).
        paragraphs: [
          `Código: ${r.code}`,
          `Producto: ${input.productName}`,
          `Marca/modelo: ${[input.brand, input.model].filter(Boolean).join(" · ") || "Pendiente"}`,
          ...(aura ? [`Resumen de AURA: ${aura.summary.slice(0, 400)}`, `Prioridad sugerida: ${aura.priority}`] : []),
          `Cliente: ${input.name.split(" ")[0]} · Canal: ${input.source}`,
          `Fotos: ${uploaded.length} · Enlaces: ${links.length}`,
        ],
        cta: { label: "Abrir en el panel", path: `/admin/solicitudes-especiales/${r.code}` },
      });
    }
    return { code: r.code, duplicate: false, link };
  } catch (e) {
    await deleteUgcPhotos(uploaded.map((u) => u.path));
    throw e;
  }
}

/** Compatibilidad con el panel anterior (estado + respuesta + producto creado). */
export async function updateProductRequest(id: string, patch: { status?: ProductRequestStatus; reply?: string; productId?: string | null }, db: PrismaClient = prisma) {
  const before = await db.productRequest.findUnique({ where: { id }, select: { status: true } });
  const r = await db.productRequest.update({
    where: { id },
    data: {
      ...(patch.status ? { status: patch.status } : {}),
      ...(patch.reply ? { adminReply: patch.reply, repliedAt: new Date() } : {}),
      ...(patch.productId !== undefined ? { productId: patch.productId } : {}),
      events: {
        create: [
          ...(patch.status && before && patch.status !== before.status ? [{ kind: "status", fromStatus: before.status, toStatus: patch.status, authorType: "admin" }] : []),
          ...(patch.reply ? [{ kind: "message", body: patch.reply, authorType: "admin" }] : []),
        ],
      },
    },
    select: { code: true, email: true, name: true, productName: true, status: true },
  });
  if (patch.reply) {
    deliverLater({
      to: r.email, kind: "product_request.reply", ref: r.code, subject: `Respuesta a tu solicitud ${r.code}`, heading: `Sobre «${r.productName}»`,
      paragraphs: [`Hola ${r.name.split(" ")[0]},`, patch.reply, `Estado: ${REQUEST_STATUS[r.status].label}.`],
    });
  }
  return r;
}
