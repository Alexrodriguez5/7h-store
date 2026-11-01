import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { getCurrentCustomer } from "@/lib/customer/auth";
import { MAX_ADDRESSES } from "@/lib/customer/addresses";
import { AddressBook } from "@/components/account/AddressBook";

export const metadata: Metadata = { title: "Direcciones" };

export default async function AddressesPage() {
  const c = (await getCurrentCustomer())!;
  const addresses = await prisma.customerAddress.findMany({
    where: { customerId: c.id },
    orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }],
    select: { id: true, label: true, fullName: true, phone: true, department: true, city: true, address: true, neighborhood: true, notes: true, isDefault: true },
  });
  return (
    <>
      <div>
        <h1 className="font-display text-4xl">Direcciones</h1>
        <p className="mt-1 text-sm text-ink-soft">Guarda hasta {MAX_ADDRESSES} direcciones para tus próximas compras.</p>
      </div>
      <AddressBook initial={addresses} max={MAX_ADDRESSES} defaultName={c.name} defaultPhone={c.phone ?? ""} />
    </>
  );
}
