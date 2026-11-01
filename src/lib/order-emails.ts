import { after } from "next/server";
import { prisma } from "@/lib/prisma";
import { formatCOP } from "@/lib/format";
import { isEmailConfigured, sendEmail } from "@/lib/email";
import { siteUrl } from "@/lib/seo";
import { BUSINESS } from "@/lib/business";

/**
 * Correos automáticos al CLIENTE en cada etapa del pedido (Resend).
 * - Nunca bloquean ni hacen fallar la operación: se envían después de responder (next/server `after`).
 * - Si RESEND_API_KEY / EMAIL_FROM no están configuradas, no se envía nada (no se simula).
 */
export type OrderEmailKind = "created" | "paid" | "shipped" | "delivered" | "cancelled" | "expired";

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

const METHOD: Record<string, string> = { CARD: "tarjeta", PSE: "PSE", BANK_TRANSFER: "transferencia bancaria", CASH_DEPOSIT: "consignación" };

interface OrderForEmail {
  publicCode: string;
  customerFullName: string;
  customerEmail: string;
  paymentMethod: string;
  subtotalCOP: number;
  shippingCOP: number;
  totalCOP: number;
  carrier: string | null;
  trackingNumber: string | null;
  city: string;
  department: string;
  address: string;
  expiresAt: Date;
  items: { name: string; size: string | null; quantity: number; unitPriceCOP: number }[];
}

/** Arma asunto y cuerpo (texto y HTML). Función pura: se prueba sin red ni base de datos. */
export function buildOrderEmail(kind: OrderEmailKind, o: OrderForEmail) {
  const first = o.customerFullName.split(" ")[0] || o.customerFullName;
  const url = `${siteUrl()}/pedido/${encodeURIComponent(o.publicCode)}`;
  const manual = o.paymentMethod === "BANK_TRANSFER" || o.paymentMethod === "CASH_DEPOSIT";
  const deadline = new Intl.DateTimeFormat("es-CO", { dateStyle: "medium", timeStyle: "short", timeZone: "America/Bogota" }).format(o.expiresAt);

  const copy: Record<OrderEmailKind, { subject: string; lead: string }> = {
    created: {
      subject: `Recibimos tu pedido ${o.publicCode}`,
      lead: manual
        ? `Recibimos tu pedido. Para confirmarlo, realiza el pago por ${METHOD[o.paymentMethod] ?? "el método elegido"} antes del ${deadline} y sube el comprobante en la página de tu pedido.`
        : `Recibimos tu pedido. Si aún no completaste el pago con ${METHOD[o.paymentMethod] ?? "Wompi"}, puedes hacerlo desde la página de tu pedido antes del ${deadline}.`,
    },
    paid: { subject: `Pago confirmado · Pedido ${o.publicCode}`, lead: "¡Tu pago fue confirmado! Ya estamos preparando tu pedido y te avisaremos cuando salga." },
    shipped: {
      subject: `Tu pedido ${o.publicCode} va en camino`,
      lead: `Tu pedido salió hacia ${o.city}, ${o.department}.${o.carrier ? ` Transportadora: ${o.carrier}.` : ""}${o.trackingNumber ? ` Número de guía: ${o.trackingNumber}.` : ""}`,
    },
    delivered: { subject: `Pedido ${o.publicCode} entregado`, lead: "Tu pedido figura como entregado. ¡Gracias por comprar en 7H STORE! Si algo no está bien, escríbenos." },
    cancelled: { subject: `Pedido ${o.publicCode} cancelado`, lead: "Tu pedido fue cancelado. Si ya habías pagado, te contactaremos para la devolución del dinero. Si tienes dudas, escríbenos." },
    expired: { subject: `Tu pedido ${o.publicCode} venció`, lead: "No recibimos el pago dentro del plazo, así que el pedido venció y las unidades se liberaron. Si aún lo quieres, puedes hacer un pedido nuevo." },
  };
  const { subject, lead } = copy[kind];
  const lines = o.items.map((i) => `${i.name}${i.size ? ` (talla ${i.size})` : ""} × ${i.quantity} — ${formatCOP(i.unitPriceCOP * i.quantity)}`);
  const contact = [BUSINESS.email, BUSINESS.whatsapp ? `WhatsApp +${BUSINESS.whatsapp}` : null, `Instagram ${BUSINESS.instagram.handle}`].filter(Boolean).join(" · ");

  const text = [
    `Hola ${first},`,
    "",
    lead,
    "",
    `Pedido: ${o.publicCode}`,
    ...lines,
    `Envío: ${o.shippingCOP === 0 ? "Gratis" : formatCOP(o.shippingCOP)}`,
    `Total: ${formatCOP(o.totalCOP)}`,
    "",
    `Ver tu pedido: ${url}`,
    "",
    `¿Dudas? ${contact}`,
    "7H STORE · Calidad. Estilo. Confianza.",
  ].join("\n");

  const rows = o.items
    .map((i) => `<tr><td style="padding:6px 0">${esc(i.name)}${i.size ? ` <span style="color:#666">· talla ${esc(i.size)}</span>` : ""} × ${i.quantity}</td><td style="padding:6px 0;text-align:right">${formatCOP(i.unitPriceCOP * i.quantity)}</td></tr>`)
    .join("");
  const html = `<div style="font-family:Arial,Helvetica,sans-serif;max-width:560px;margin:auto;color:#0a0a0a;background:#f5f1e8;padding:24px">
<p style="font-size:22px;letter-spacing:4px;color:#c9a44c;margin:0 0 18px"><strong>7H STORE</strong></p>
<p>Hola ${esc(first)},</p><p style="line-height:1.6">${esc(lead)}</p>
<table style="width:100%;border-collapse:collapse;font-size:14px;margin:16px 0;border-top:1px solid #ddd;border-bottom:1px solid #ddd">
<tr><td colspan="2" style="padding:8px 0;font-weight:bold">Pedido ${esc(o.publicCode)}</td></tr>${rows}
<tr><td style="padding:6px 0;color:#555">Envío</td><td style="padding:6px 0;text-align:right">${o.shippingCOP === 0 ? "Gratis" : formatCOP(o.shippingCOP)}</td></tr>
<tr><td style="padding:8px 0;font-weight:bold">Total</td><td style="padding:8px 0;text-align:right;font-weight:bold">${formatCOP(o.totalCOP)}</td></tr></table>
<p><a href="${esc(url)}" style="display:inline-block;background:#0a0a0a;color:#f5f1e8;padding:12px 20px;border-radius:999px;text-decoration:none">Ver mi pedido</a></p>
<p style="font-size:12px;color:#555;line-height:1.6">¿Dudas? ${esc(contact)}<br>7H STORE · Calidad. Estilo. Confianza.</p></div>`;
  return { subject, text, html };
}

async function send(kind: OrderEmailKind, where: { id: string } | { publicCode: string }) {
  const order = await prisma.order.findUnique({ where, include: { items: true } });
  if (!order) return;
  const ok = await sendEmail({ to: order.customerEmail, ...buildOrderEmail(kind, order) });
  console.info(`[order-email] ${order.publicCode} ${kind} → ${ok ? "enviado" : "no enviado"}`);
}

/** Programa el correo para después de la respuesta HTTP. Nunca lanza errores. */
export function notifyCustomer(kind: OrderEmailKind, where: { id: string } | { publicCode: string }) {
  if (!isEmailConfigured()) return;
  const task = () => send(kind, where).catch((e) => console.error("[order-email] error:", e instanceof Error ? e.message : e));
  try {
    after(task);
  } catch {
    void task(); // fuera de una petición de Next (scripts): se envía directamente
  }
}
