import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { emailField, personName } from "@/lib/validation/fields";
import type { InquiryStatus, InquiryTopic, PrismaClient } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { deliverLater, supportInbox } from "@/lib/mailer";
import { UgcError, textProblem } from "@/lib/ugc";

/**
 * "Habla con 7H STORE": consultas persistentes (no es un chat simulado).
 * El cliente escribe; el equipo responde desde el panel; cada respuesta llega por correo con el enlace
 * a la conversación. Un invitado entra con un enlace secreto (solo se guarda su hash).
 */
export const TOPICS: Record<InquiryTopic, string> = {
  DISPONIBILIDAD: "Disponibilidad",
  TALLAS: "Tallas",
  CARACTERISTICAS: "Características de un producto",
  SOLICITUD_ESPECIAL: "Solicitud especial",
  ENVIOS: "Envíos",
  PEDIDOS: "Un pedido",
  GARANTIAS: "Garantías",
  OTRO: "Otro tema",
};
export const INQUIRY_STATUS: Record<InquiryStatus, string> = { ABIERTA: "Esperando respuesta", RESPONDIDA: "Respondida", CERRADA: "Cerrada" };

const body = z.string().trim().min(5, "Escribe un poco más").max(2000, "Máximo 2.000 caracteres");

export const inquiryInput = z.object({
  name: personName(2, 80),
  email: emailField,
  topic: z.enum(Object.keys(TOPICS) as [InquiryTopic, ...InquiryTopic[]]),
  subject: z.string().trim().min(3, "Escribe el asunto").max(120),
  message: body,
  productSlug: z.string().trim().max(100).regex(/^[a-z0-9-]*$/).optional().or(z.literal("")),
  consent: z.literal(true, { error: "Debes autorizar el uso de tus datos para responderte." }),
  website: z.string().max(200).optional(),
});
export const messageInput = z.object({ message: body, t: z.string().max(100).optional() });

const hash = (t: string) => createHash("sha256").update(t).digest("hex");
export function tokenMatches(token: string | undefined, accessHash: string) {
  if (!token) return false;
  const a = Buffer.from(hash(token));
  const b = Buffer.from(accessHash);
  return a.length === b.length && timingSafeEqual(a, b);
}

async function nextCode(db: PrismaClient, now = new Date()) {
  const year = now.getFullYear();
  const c = await db.counter.upsert({ where: { key: `consulta:${year}` }, create: { key: `consulta:${year}`, value: 1 }, update: { value: { increment: 1 } } });
  return `CON-${year}-${String(c.value).padStart(6, "0")}`;
}

function checkText(...texts: string[]) {
  for (const t of texts) {
    const p = textProblem(t);
    if (p && !p.includes("enlaces")) throw new UgcError(400, p);
  }
}

export async function createInquiry(input: z.infer<typeof inquiryInput>, customerId: string | null, db: PrismaClient = prisma) {
  if (input.website) throw new UgcError(400, "No pudimos enviar tu consulta.");
  checkText(input.subject, input.message);
  const token = randomBytes(24).toString("base64url");
  const code = await nextCode(db);
  await db.inquiry.create({
    data: {
      code, accessHash: hash(token), customerId, name: input.name, email: input.email, topic: input.topic, subject: input.subject,
      productSlug: input.productSlug || null, messages: { create: { author: "customer", body: input.message } },
    },
  });
  const link = `/habla-con-7h/${code}?t=${token}`;
  deliverLater({
    to: input.email, kind: "inquiry.created", ref: code, subject: `Recibimos tu consulta ${code}`, heading: "Hablemos",
    paragraphs: [`Hola ${input.name.split(" ")[0]}, recibimos tu consulta sobre «${input.subject}».`, "Una persona del equipo te responderá pronto. Te avisaremos por correo y podrás ver toda la conversación en el enlace."],
    cta: { label: "Ver mi consulta", path: link },
  });
  const inbox = supportInbox();
  if (inbox) {
    deliverLater({
      to: inbox, kind: "inquiry.staff", ref: code, subject: `[${code}] ${TOPICS[input.topic]}: ${input.subject.slice(0, 60)}`, heading: "Nueva consulta",
      paragraphs: [`De: ${input.name} <${input.email}>`, input.message.slice(0, 1500)],
      cta: { label: "Responder en el panel", path: "/admin/consultas" },
    });
  }
  return { code, link };
}

/** Mensaje del cliente en una conversación existente (con sesión dueña o con el enlace secreto). */
export async function addCustomerMessage(code: string, message: string, access: { customerId?: string; token?: string }, db: PrismaClient = prisma) {
  checkText(message);
  const q = await db.inquiry.findUnique({ where: { code }, select: { id: true, customerId: true, accessHash: true, status: true, subject: true, name: true, email: true } });
  if (!q || !(tokenMatches(access.token, q.accessHash) || (access.customerId && q.customerId === access.customerId))) throw new UgcError(404, "Consulta no encontrada.");
  if (q.status === "CERRADA") throw new UgcError(400, "Esta consulta está cerrada. Abre una nueva si necesitas algo más.");
  await db.$transaction([
    db.inquiryMessage.create({ data: { inquiryId: q.id, author: "customer", body: message } }),
    db.inquiry.update({ where: { id: q.id }, data: { status: "ABIERTA" } }),
  ]);
  const inbox = supportInbox();
  if (inbox) deliverLater({ to: inbox, kind: "inquiry.customer_message", ref: code, subject: `[${code}] Nuevo mensaje del cliente`, heading: q.subject, paragraphs: [`De: ${q.name} <${q.email}>`, message.slice(0, 1500)], cta: { label: "Responder en el panel", path: "/admin/consultas" } });
}

/** Respuesta del equipo (y/o cambio de estado). El cliente recibe un correo con un enlace NUEVO a la conversación. */
export async function staffReply(id: string, adminId: string, patch: { reply?: string; status?: InquiryStatus }, db: PrismaClient = prisma) {
  const q = await db.inquiry.findUnique({ where: { id }, select: { id: true, code: true, name: true, email: true, subject: true } });
  if (!q) throw new UgcError(404, "Consulta no encontrada.");
  let token: string | null = null;
  if (patch.reply) {
    token = randomBytes(24).toString("base64url");
    await db.$transaction([
      db.inquiryMessage.create({ data: { inquiryId: id, author: "admin", adminId, body: patch.reply } }),
      db.inquiry.update({ where: { id }, data: { status: patch.status ?? "RESPONDIDA", accessHash: hash(token) } }),
    ]);
    deliverLater({
      to: q.email, kind: "inquiry.reply", ref: q.code, subject: `Respuesta a tu consulta ${q.code}`, heading: q.subject,
      paragraphs: [`Hola ${q.name.split(" ")[0]}, te respondimos:`, patch.reply.slice(0, 1800)],
      cta: { label: "Ver la conversación", path: `/habla-con-7h/${q.code}?t=${token}` },
    });
  } else if (patch.status) {
    await db.inquiry.update({ where: { id }, data: { status: patch.status } });
  }
  return q;
}
