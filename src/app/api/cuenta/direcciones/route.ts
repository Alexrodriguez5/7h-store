import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireCustomer } from "@/lib/customer/auth";
import { body, fail } from "@/lib/customer/http";
import { MAX_ADDRESSES, addressInput } from "@/lib/customer/addresses";

export async function POST(req: Request) {
  const auth = await requireCustomer(req);
  if ("error" in auth) return auth.error;
  const b = await body(req, addressInput);
  if ("error" in b) return b.error;
  try {
    const count = await prisma.customerAddress.count({ where: { customerId: auth.customer.id } });
    if (count >= MAX_ADDRESSES) return NextResponse.json({ error: `Puedes guardar hasta ${MAX_ADDRESSES} direcciones.` }, { status: 400 });
    const isDefault = b.data.isDefault || count === 0;
    if (isDefault) await prisma.customerAddress.updateMany({ where: { customerId: auth.customer.id }, data: { isDefault: false } });
    const address = await prisma.customerAddress.create({ data: { ...b.data, neighborhood: b.data.neighborhood || null, notes: b.data.notes || null, isDefault, customerId: auth.customer.id } });
    return NextResponse.json({ address }, { status: 201 });
  } catch (e) {
    return fail(e);
  }
}
