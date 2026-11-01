import type { Customer, PrismaClient, SupportStatus, SupportType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { MAX_EVIDENCE_FILES, MAX_EVIDENCE_TOTAL, SUPPORT_STATUS, SUPPORT_TYPES, addBusinessDays, detectEvidenceType, supportCode } from "@/lib/support";
import { deliverLater, supportInbox } from "@/lib/mailer";

export class SupportError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

/** Pedidos visibles para el cliente: los de su correo VERIFICADO (incluye compras como invitado). */
export function customerOrdersWhere(c: Pick<Customer, "email" | "emailVerifiedAt">) {
  return c.emailVerifiedAt ? { customerEmail: c.email } : { id: "__ninguno__" };
}

export async function findCustomerOrder(c: Customer, publicCode: string, db: PrismaClient = prisma) {
  if (!c.emailVerifiedAt) return null;
  return db.order.findFirst({ where: { publicCode, customerEmail: c.email }, include: { items: { include: { product: { select: { images: true, slug: true } } } }, payments: { select: { status: true, provider: true, createdAt: true } } } });
}

/** Radicado secuencial por año, atómico (SOL-2026-000001). */
async function nextCode(db: PrismaClient, now = new Date()) {
  const year = now.getFullYear();
  const c = await db.counter.upsert({ where: { key: `support:${year}` }, create: { key: `support:${year}`, value: 1 }, update: { value: { increment: 1 } } });
  return supportCode(year, c.value);
}

export interface EvidenceFile { name: string; bytes: Uint8Array }

export function validateEvidence(files: EvidenceFile[]) {
  if (files.length > MAX_EVIDENCE_FILES) throw new SupportError(400, `Máximo ${MAX_EVIDENCE_FILES} archivos por envío.`);
  const total = files.reduce((s, f) => s + f.bytes.byteLength, 0);
  if (total > MAX_EVIDENCE_TOTAL) throw new SupportError(400, "Los archivos superan 4 MB en total. Envía menos o más livianos (puedes agregar más después).");
  return files.map((f) => {
    const t = detectEvidenceType(f.bytes);
    if (!t) throw new SupportError(400, `"${f.name.slice(0, 60)}" no es una foto (JPG, PNG, WebP, HEIC) ni un video (MP4, MOV, WebM).`);
    return { fileName: f.name.replace(/[^\w.\- ]+/g, "_").slice(0, 80) || `archivo.${t.ext}`, mime: t.mime, size: f.bytes.byteLength, data: Buffer.from(f.bytes) };
  });
}

export interface NewSupportInput {
  orderCode: string;
  type: SupportType;
  reason: string;
  description: string;
  contactPhone?: string;
  items: { orderItemId: string; quantity: number }[];
}

export async function createSupportRequest(customer: Customer, input: NewSupportInput, files: EvidenceFile[], db: PrismaClient = prisma) {
  if (!customer.emailVerifiedAt) throw new SupportError(403, "Verifica tu correo para crear solicitudes.");
  const order = await findCustomerOrder(customer, input.orderCode, db);
  if (!order) throw new SupportError(404, "No encontramos ese pedido en tu cuenta.");
  const info = SUPPORT_TYPES[input.type];
  const byId = new Map(order.items.map((i) => [i.id, i]));
  const items = input.items.filter((i) => i.quantity > 0);
  if (info.needsItems && items.length === 0) throw new SupportError(400, "Elige al menos un producto del pedido.");
  for (const it of items) {
    const oi = byId.get(it.orderItemId);
    if (!oi) throw new SupportError(400, "Un producto no pertenece a este pedido.");
    if (it.quantity > oi.quantity) throw new SupportError(400, `La cantidad de "${oi.name}" supera la comprada (${oi.quantity}).`);
  }
  const attachments = validateEvidence(files);
  const now = new Date();
  const created = await db.$transaction(async (tx) => {
    const code = await nextCode(tx as unknown as PrismaClient, now);
    return tx.supportRequest.create({
      data: {
        code, customerId: customer.id, orderId: order.id, type: input.type, reason: input.reason, description: input.description,
        contactEmail: customer.email, contactPhone: input.contactPhone || customer.phone || null, dueAt: addBusinessDays(now, info.responseDays),
        items: { create: items.map((i) => ({ orderItemId: i.orderItemId, quantity: i.quantity })) },
        attachments: { create: attachments.map((a) => ({ ...a, uploadedBy: "customer" })) },
        events: { create: { kind: "created", toStatus: "RECIBIDA", authorType: "customer", body: input.description, visibleToCustomer: true } },
      },
    });
  }, { maxWait: 10_000, timeout: 20_000 });

  deliverLater({
    to: customer.email, kind: "support.created", ref: created.code, subject: `Radicamos tu solicitud ${created.code} · 7H STORE`, heading: `Solicitud ${created.code} recibida`,
    paragraphs: [`Recibimos tu solicitud de «${info.label}» para el pedido ${order.publicCode}.`, `La revisaremos y te responderemos a más tardar el ${fmt(created.dueAt!)}. Puedes ver su estado en «Mi cuenta».`, info.legal],
    cta: { label: "Ver mi solicitud", path: `/cuenta/solicitudes/${created.code}` },
  });
  const inbox = supportInbox();
  if (inbox) {
    deliverLater({
      to: inbox, kind: "support.staff", ref: created.code, subject: `[${created.code}] Nueva solicitud: ${info.label} · pedido ${order.publicCode}`, heading: `Nueva solicitud ${created.code}`,
      paragraphs: [`Tipo: ${info.label}`, `Pedido: ${order.publicCode}`, `Cliente: ${customer.name} <${customer.email}>`, `Motivo: ${input.reason}`, `Vence: ${fmt(created.dueAt!)}`],
      cta: { label: "Abrir en el panel", path: `/admin/solicitudes/${created.code}` },
    });
  }
  return created;
}

const fmt = (d: Date) => new Intl.DateTimeFormat("es-CO", { dateStyle: "long", timeZone: "America/Bogota" }).format(d);

/** Mensaje del cliente en su solicitud (con evidencias opcionales). Si el equipo pidió información, vuelve a "En revisión". */
export async function addCustomerMessage(customer: Customer, code: string, text: string, files: EvidenceFile[], db: PrismaClient = prisma) {
  const req = await db.supportRequest.findFirst({ where: { code, customerId: customer.id } });
  if (!req) throw new SupportError(404, "Solicitud no encontrada.");
  if (SUPPORT_STATUS[req.status].final) throw new SupportError(409, "Esta solicitud ya está cerrada. Si necesitas algo más, crea una nueva.");
  const attachments = validateEvidence(files);
  const reopen = req.status === "INFO_SOLICITADA";
  await db.$transaction([
    db.supportEvent.create({ data: { requestId: req.id, kind: "message", authorType: "customer", body: text, visibleToCustomer: true } }),
    ...attachments.map((a) => db.supportAttachment.create({ data: { ...a, requestId: req.id, uploadedBy: "customer" } })),
    ...(reopen
      ? [
          db.supportRequest.update({ where: { id: req.id }, data: { status: "EN_REVISION" } }),
          db.supportEvent.create({ data: { requestId: req.id, kind: "status", fromStatus: "INFO_SOLICITADA", toStatus: "EN_REVISION", authorType: "system", visibleToCustomer: true } }),
        ]
      : [db.supportRequest.update({ where: { id: req.id }, data: { updatedAt: new Date() } })]),
  ]);
  const inbox = supportInbox();
  if (inbox) {
    deliverLater({
      to: inbox, kind: "support.customer_message", ref: req.code, subject: `[${req.code}] Nuevo mensaje del cliente`, heading: `Nuevo mensaje en ${req.code}`,
      paragraphs: [text.slice(0, 1500), attachments.length ? `${attachments.length} archivo(s) adjunto(s).` : ""].filter(Boolean),
      cta: { label: "Abrir en el panel", path: `/admin/solicitudes/${req.code}` },
    });
  }
}

export interface StaffAction {
  status?: SupportStatus;
  /** Mensaje visible para el cliente (se le envía por correo). */
  message?: string;
  /** Nota interna: NUNCA visible para el cliente. */
  note?: string;
  assignedAdminId?: string | null;
  resolution?: string;
  refundAmountCOP?: number | null;
  refundReference?: string | null;
}

/** Acción del equipo: cambio de estado, mensaje, nota interna, asignación o registro de reembolso. Todo queda en el historial. */
export async function applyStaffAction(code: string, adminId: string, a: StaffAction, db: PrismaClient = prisma) {
  const req = await db.supportRequest.findUnique({ where: { code }, include: { customer: true, order: { select: { publicCode: true } } } });
  if (!req) throw new SupportError(404, "Solicitud no encontrada.");
  if (a.status === "NO_APROBADA" && !a.message?.trim()) throw new SupportError(400, "Para no aprobar una solicitud debes explicar el motivo al cliente.");
  if (a.status === "INFO_SOLICITADA" && !a.message?.trim()) throw new SupportError(400, "Escribe qué información necesitas del cliente.");
  const statusChanged = !!a.status && a.status !== req.status;
  const events: Parameters<typeof db.supportEvent.create>[0]["data"][] = [];
  if (statusChanged) events.push({ requestId: req.id, kind: "status", fromStatus: req.status, toStatus: a.status!, authorType: "admin", adminId, visibleToCustomer: true });
  if (a.message?.trim()) events.push({ requestId: req.id, kind: "message", body: a.message.trim(), authorType: "admin", adminId, visibleToCustomer: true });
  if (a.note?.trim()) events.push({ requestId: req.id, kind: "note", body: a.note.trim(), authorType: "admin", adminId, visibleToCustomer: false });
  if (a.assignedAdminId !== undefined && a.assignedAdminId !== req.assignedAdminId) events.push({ requestId: req.id, kind: "assigned", body: a.assignedAdminId ?? "sin asignar", authorType: "admin", adminId, visibleToCustomer: false });
  const refundChanged = a.refundAmountCOP !== undefined && a.refundAmountCOP !== req.refundAmountCOP;
  if (refundChanged) events.push({ requestId: req.id, kind: "refund", body: `Reembolso registrado: ${a.refundAmountCOP ?? 0} COP${a.refundReference ? ` · ref. ${a.refundReference}` : ""}`, authorType: "admin", adminId, visibleToCustomer: true });
  if (!events.length && a.resolution === undefined) throw new SupportError(400, "No hay cambios para guardar.");

  await db.$transaction([
    db.supportRequest.update({
      where: { id: req.id },
      data: {
        ...(statusChanged ? { status: a.status } : {}),
        ...(a.assignedAdminId !== undefined ? { assignedAdminId: a.assignedAdminId } : {}),
        ...(a.resolution !== undefined ? { resolution: a.resolution || null } : {}),
        ...(a.refundAmountCOP !== undefined ? { refundAmountCOP: a.refundAmountCOP } : {}),
        ...(a.refundReference !== undefined ? { refundReference: a.refundReference || null } : {}),
      },
    }),
    ...events.map((data) => db.supportEvent.create({ data })),
  ]);

  // El cliente solo recibe lo que le corresponde: estados, mensajes y reembolsos (nunca notas internas).
  const lines: string[] = [];
  if (statusChanged) lines.push(`Nuevo estado: ${SUPPORT_STATUS[a.status!].label}.`);
  if (a.message?.trim()) lines.push(a.message.trim());
  if (refundChanged && a.refundAmountCOP) lines.push(`Registramos un reembolso por $${a.refundAmountCOP.toLocaleString("es-CO")}${a.refundReference ? ` (referencia ${a.refundReference})` : ""}. El tiempo en verse reflejado depende de tu banco o medio de pago.`);
  if (lines.length) {
    deliverLater({
      to: req.contactEmail, kind: a.status === "INFO_SOLICITADA" ? "support.info_requested" : refundChanged ? "support.refund" : "support.updated", ref: req.code,
      subject: `Actualización de tu solicitud ${req.code} · 7H STORE`, heading: `Tu solicitud ${req.code} fue actualizada`,
      paragraphs: [`Pedido ${req.order.publicCode}.`, ...lines],
      cta: { label: a.status === "INFO_SOLICITADA" ? "Responder" : "Ver mi solicitud", path: `/cuenta/solicitudes/${req.code}` },
    });
  }
}
