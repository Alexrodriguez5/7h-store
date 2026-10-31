import Link from "next/link";
import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { getCurrentCustomer } from "@/lib/customer/auth";
import { customerOrdersWhere } from "@/lib/services/support";
import { SUPPORT_TYPES } from "@/lib/support";
import { NewSupportForm } from "@/components/account/NewSupportForm";
import { Notice, Panel } from "@/components/account/ui";

export const metadata: Metadata = { title: "Nueva solicitud" };

export default async function NewRequestPage({ searchParams }: { searchParams: Promise<{ pedido?: string }> }) {
  const c = (await getCurrentCustomer())!;
  const { pedido } = await searchParams;
  if (!c.emailVerifiedAt) return <Notice>Confirma tu correo para poder crear solicitudes.</Notice>;
  const orders = await prisma.order.findMany({
    where: { ...customerOrdersWhere(c), status: { not: "EXPIRED" } },
    orderBy: { createdAt: "desc" },
    take: 50,
    select: { publicCode: true, createdAt: true, status: true, items: { select: { id: true, name: true, size: true, quantity: true } } },
  });
  return (
    <>
      <Link href="/cuenta/solicitudes" className="text-xs text-ink-soft underline-offset-4 hover:underline">← Solicitudes</Link>
      <h1 className="font-display text-4xl">Nueva solicitud</h1>
      {orders.length === 0 ? (
        <Panel><p className="text-sm text-ink-soft">No encontramos pedidos con tu correo. Si compraste con otro correo, entra con ese correo o escríbenos desde <Link href="/contacto" className="underline">Contacto</Link> para revisarlo manualmente.</p></Panel>
      ) : (
        <NewSupportForm
          orders={orders.map((o) => ({ code: o.publicCode, date: o.createdAt.toISOString(), status: o.status, items: o.items }))}
          initialOrder={orders.some((o) => o.publicCode === pedido) ? pedido! : orders[0].publicCode}
          types={Object.entries(SUPPORT_TYPES).map(([key, t]) => ({ key, ...t }))}
          phone={c.phone ?? ""}
        />
      )}
    </>
  );
}
