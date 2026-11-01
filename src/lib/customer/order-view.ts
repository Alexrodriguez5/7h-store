import type { OrderStatus } from "@prisma/client";
import { derivePaymentStatus, type PaymentLike } from "@/lib/order-status";

/** Estados separados para el cliente: financiero (pago) y logístico (preparación, envío, entrega). */
export function paymentView(status: OrderStatus, payments: PaymentLike[]) {
  const p = derivePaymentStatus(payments);
  if (p === "APPROVED" || ["PAID", "PROCESSING", "SHIPPED", "DELIVERED"].includes(status)) return { label: "Pago confirmado", tone: "success" as const };
  if (status === "EXPIRED") return { label: "Pago no recibido", tone: "neutral" as const };
  if (status === "CANCELLED") return { label: "Cancelado", tone: "neutral" as const };
  if (p === "FAILED" || p === "REJECTED") return { label: "Pago rechazado", tone: "error" as const };
  return { label: "Pago pendiente", tone: "warning" as const };
}

export function logisticsView(status: OrderStatus) {
  switch (status) {
    case "PENDING_PAYMENT": return { label: "Esperando pago", tone: "neutral" as const };
    case "PAID": return { label: "Por preparar", tone: "gold" as const };
    case "PROCESSING": return { label: "Preparando", tone: "gold" as const };
    case "SHIPPED": return { label: "En camino", tone: "gold" as const };
    case "DELIVERED": return { label: "Entregado", tone: "success" as const };
    case "CANCELLED": return { label: "Cancelado", tone: "error" as const };
    case "EXPIRED": return { label: "Vencido", tone: "neutral" as const };
  }
}

/** Página de rastreo pública de la transportadora (sin inventar enlaces profundos que no podemos verificar). */
const CARRIER_SITES: Record<string, string> = {
  servientrega: "https://www.servientrega.com",
  coordinadora: "https://www.coordinadora.com",
  tcc: "https://tcc.com.co",
  interrapidisimo: "https://www.interrapidisimo.com",
  envia: "https://envia.co",
};
export const carrierSite = (carrier: string | null) => (carrier ? CARRIER_SITES[carrier.toLowerCase().replace(/[^a-z]/g, "")] ?? null : null);

/** Un pedido admite solicitudes cuando ya se pagó o se intentó pagar (no en pedidos vencidos sin pago). */
export const canRequestSupport = (status: OrderStatus) => status !== "EXPIRED";
