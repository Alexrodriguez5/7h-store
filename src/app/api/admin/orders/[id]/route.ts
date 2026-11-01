import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin/guard";
import { handleError, parseBody } from "@/lib/admin/http";
import { audit } from "@/lib/admin/audit";
import { orderActionInput } from "@/lib/schemas/admin";
import { changeOrderStatus, confirmManualPayment } from "@/lib/services/order-lifecycle";
import { invalidateProducts } from "@/lib/cache";
import { notifyCustomer, type OrderEmailKind } from "@/lib/order-emails";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { ctx, error } = await requireAdmin(req);
  if (error) return error;
  const body = await parseBody(req, orderActionInput);
  if ("error" in body) return body.error;
  const { id } = await params;
  const base = { adminId: ctx.admin.id, actorEmail: ctx.admin.email, entityType: "order", entityId: id, ip: ctx.ip };
  try {
    if (body.data.action === "confirm_manual_payment") {
      const order = await confirmManualPayment(id);
      notifyCustomer("paid", { id: order.id });
      await audit({ ...base, action: "order.manual_payment_confirmed", details: { publicCode: order.publicCode, totalCOP: order.totalCOP, method: order.paymentMethod } });
      return NextResponse.json({ ok: true, status: order.status });
    }
    const d = body.data;
    const { order, previous, restocked } = await changeOrderStatus({ orderId: id, to: d.status, carrier: d.carrier, trackingNumber: d.trackingNumber, restock: d.restock });
    if (restocked) invalidateProducts();
    const emailFor: Partial<Record<string, OrderEmailKind>> = { SHIPPED: "shipped", DELIVERED: "delivered", CANCELLED: "cancelled" };
    const kind = emailFor[order.status];
    if (kind) notifyCustomer(kind, { id: order.id });
    await audit({ ...base, action: "order.status_changed", details: { publicCode: order.publicCode, from: previous, to: order.status, restocked, ...(d.status === "SHIPPED" ? { carrier: order.carrier, trackingNumber: order.trackingNumber } : {}) } });
    return NextResponse.json({ ok: true, status: order.status });
  } catch (e) {
    return handleError(e);
  }
}
