import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireCustomer } from "@/lib/customer/auth";
import { body, fail } from "@/lib/customer/http";
import { addressInput } from "@/lib/customer/addresses";

type Ctx = { params: Promise<{ id: string }> };

/** Solo el dueño puede editar o borrar su dirección (el filtro incluye customerId). */
export async function PATCH(req: Request, { params }: Ctx) {
  const auth = await requireCustomer(req);
  if ("error" in auth) return auth.error;
  const b = await body(req, addressInput);
  if ("error" in b) return b.error;
  const { id } = await params;
  try {
    const own = await prisma.customerAddress.findFirst({ where: { id, customerId: auth.customer.id } });
    if (!own) return NextResponse.json({ error: "Dirección no encontrada." }, { status: 404 });
    if (b.data.isDefault) await prisma.customerAddress.updateMany({ where: { customerId: auth.customer.id }, data: { isDefault: false } });
    const address = await prisma.customerAddress.update({ where: { id }, data: { ...b.data, neighborhood: b.data.neighborhood || null, notes: b.data.notes || null } });
    return NextResponse.json({ address });
  } catch (e) {
    return fail(e);
  }
}

export async function DELETE(req: Request, { params }: Ctx) {
  const auth = await requireCustomer(req);
  if ("error" in auth) return auth.error;
  const { id } = await params;
  try {
    const r = await prisma.customerAddress.deleteMany({ where: { id, customerId: auth.customer.id } });
    if (!r.count) return NextResponse.json({ error: "Dirección no encontrada." }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return fail(e);
  }
}
