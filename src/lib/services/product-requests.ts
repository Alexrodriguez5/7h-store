import type { PrismaClient, ProductRequestStatus } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { deliverLater, supportInbox } from "@/lib/mailer";
import { UgcError, deleteUgcPhotos, textProblem, uploadUgcPhoto } from "@/lib/ugc";

/** "Tú lo buscas. Nosotros lo exploramos": estados y su significado para el cliente. */
export const REQUEST_STATUS: Record<ProductRequestStatus, { label: string; customer: string }> = {
  NUEVA: { label: "Nueva", customer: "Recibimos tu solicitud." },
  EN_REVISION: { label: "En revisión", customer: "Estamos revisando tu solicitud." },
  COTIZANDO: { label: "Cotizando", customer: "Estamos consultando disponibilidad y precio." },
  DISPONIBLE: { label: "Disponible para ofrecer", customer: "¡Podemos conseguirlo! Te contamos los detalles." },
  NO_DISPONIBLE: { label: "No disponible", customer: "Por ahora no podemos conseguir este producto." },
  FINALIZADA: { label: "Finalizada", customer: "Tu solicitud está cerrada." },
};
export const REQUEST_STATUS_ORDER = Object.keys(REQUEST_STATUS) as ProductRequestStatus[];

const optional = (max: number) => z.string().trim().max(max).optional().or(z.literal("")).transform((v) => v || null);

export const productRequestInput = z.object({
  name: z.string().trim().min(2, "Escribe tu nombre").max(80),
  email: z.string().trim().toLowerCase().max(254).pipe(z.email("Correo no válido")),
  productName: z.string().trim().min(2, "¿Qué producto buscas?").max(120),
  brand: optional(60),
  model: optional(80),
  url: z.string().trim().max(500).optional().or(z.literal("")).refine((v) => !v || /^https:\/\/[^\s]+$/i.test(v), "El enlace debe empezar por https://").transform((v) => v || null),
  budgetCOP: z.number().int().min(0).max(100_000_000).nullable().optional(),
  comments: optional(1000),
  /** Autorización para usar el correo solo para responder la solicitud (Ley 1581). */
  consent: z.literal(true, { error: "Debes autorizar el uso de tus datos para responderte." }),
  website: z.string().max(200).optional(),
});
export type ProductRequestInput = z.infer<typeof productRequestInput>;

async function nextCode(db: PrismaClient, now = new Date()) {
  const year = now.getFullYear();
  const c = await db.counter.upsert({ where: { key: `busqueda:${year}` }, create: { key: `busqueda:${year}`, value: 1 }, update: { value: { increment: 1 } } });
  return `BUS-${year}-${String(c.value).padStart(6, "0")}`;
}

/** Registra la solicitud (con foto opcional en el bucket privado) y avisa al equipo y al cliente. */
export async function createProductRequest(input: ProductRequestInput, photo: Uint8Array | null, customerId: string | null, db: PrismaClient = prisma) {
  if (input.website) throw new UgcError(400, "No pudimos enviar tu solicitud.");
  for (const t of [input.productName, input.comments ?? "", input.brand ?? "", input.model ?? ""]) {
    const p = textProblem(t);
    if (p && !p.includes("enlaces")) throw new UgcError(400, p);
  }
  let image: { path: string; mime: string } | null = null;
  try {
    if (photo) image = await uploadUgcPhoto("solicitudes", photo);
    const code = await nextCode(db);
    const r = await db.productRequest.create({
      data: {
        code, customerId, name: input.name, email: input.email, productName: input.productName, brand: input.brand, model: input.model,
        url: input.url, budgetCOP: input.budgetCOP ?? null, comments: input.comments, imagePath: image?.path ?? null, imageMime: image?.mime ?? null,
      },
      select: { code: true },
    });
    deliverLater({
      to: input.email, kind: "product_request.created", ref: r.code, subject: `Recibimos tu solicitud ${r.code}`, heading: "Tú lo buscas. Nosotros lo exploramos.",
      paragraphs: [`Hola ${input.name.split(" ")[0]}, recibimos tu solicitud de «${input.productName}».`, "Vamos a explorar si podemos conseguirlo y te escribiremos a este correo. No todos los productos se pueden traer, pero revisamos cada solicitud.", `Tu radicado es ${r.code}.`],
    });
    const inbox = supportInbox();
    if (inbox) {
      deliverLater({
        to: inbox, kind: "product_request.staff", ref: r.code, subject: `[${r.code}] Nueva solicitud: ${input.productName.slice(0, 60)}`, heading: "Nueva solicitud de producto",
        paragraphs: [`Producto: ${input.productName}`, `Marca/modelo: ${[input.brand, input.model].filter(Boolean).join(" · ") || "—"}`, `Cliente: ${input.name} <${input.email}>`],
        cta: { label: "Abrir en el panel", path: "/admin/tu-lo-buscas" },
      });
    }
    return r;
  } catch (e) {
    if (image) await deleteUgcPhotos([image.path]);
    throw e;
  }
}

/** Respuesta y cambio de estado desde el panel; el cliente recibe la respuesta por correo. */
export async function updateProductRequest(id: string, patch: { status?: ProductRequestStatus; reply?: string; productId?: string | null }, db: PrismaClient = prisma) {
  const r = await db.productRequest.update({
    where: { id },
    data: {
      ...(patch.status ? { status: patch.status } : {}),
      ...(patch.reply ? { adminReply: patch.reply, repliedAt: new Date() } : {}),
      ...(patch.productId !== undefined ? { productId: patch.productId } : {}),
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
