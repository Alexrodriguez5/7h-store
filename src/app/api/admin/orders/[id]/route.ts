import { NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/admin/guard";
import { handleError, parseBody } from "@/lib/admin/http";
import { orderActionInput } from "@/lib/schemas/admin";
import { changeOrderStatus, confirmManualPayment } from "@/lib/services/order-lifecycle";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const denied = await requireAdminApi(req);
  if (denied) return denied;
  const body = await parseBody(req, orderActionInput);
  if ("error" in body) return body.error;
  const { id } = await params;
  try {
    const order =
      body.data.action === "confirm_manual_payment"
        ? await confirmManualPayment(id)
        : await changeOrderStatus({ orderId: id, to: body.data.status, carrier: body.data.carrier, trackingNumber: body.data.trackingNumber, restock: body.data.restock });
    return NextResponse.json({ ok: true, status: order.status });
  } catch (e) {
    return handleError(e);
  }
}
