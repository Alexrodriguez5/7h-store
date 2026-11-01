import Link from "next/link";
import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { requireCustomerPage } from "@/lib/customer/auth";
import { SUPPORT_STATUS, SUPPORT_TYPES } from "@/lib/support";
import { Panel, Pill, fmtDate } from "@/components/account/ui";

export const metadata: Metadata = { title: "Solicitudes y garantías" };

export default async function MyRequestsPage() {
  const c = await requireCustomerPage();
  const list = await prisma.supportRequest.findMany({
    where: { customerId: c.id },
    orderBy: { updatedAt: "desc" },
    select: { code: true, type: true, status: true, createdAt: true, updatedAt: true, dueAt: true, order: { select: { publicCode: true } } },
  });
  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-4xl sm:text-5xl">Solicitudes y garantías</h1>
          <p className="mt-2 text-sm text-ink-soft">Devoluciones, retracto, garantías, reclamos y cualquier requerimiento, con número de radicado.</p>
        </div>
        <Link href="/cuenta/solicitudes/nueva" className="rounded-full bg-gold px-5 py-3 text-sm font-semibold text-ink shadow-soft hover:bg-gold-light">Nueva solicitud</Link>
      </div>
      {list.length === 0 ? (
        <Panel><p className="py-6 text-center text-sm text-ink-soft">Aún no tienes solicitudes. Para crear una, entra al pedido y pulsa «Solicitar soporte o devolución».</p></Panel>
      ) : (
        <ul className="space-y-3">
          {list.map((r) => {
            const st = SUPPORT_STATUS[r.status];
            return (
              <li key={r.code}>
                <Link href={`/cuenta/solicitudes/${r.code}`} className="block rounded-3xl border border-ink/[.07] bg-white/75 p-5 shadow-soft transition-shadow hover:shadow-lift">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <p className="font-mono font-semibold">{r.code}</p>
                    <Pill tone={st.tone}>{st.label}</Pill>
                  </div>
                  <p className="mt-1 text-sm">{SUPPORT_TYPES[r.type].label} · Pedido {r.order.publicCode}</p>
                  <p className="mt-1 text-xs text-ink-soft">Creada el {fmtDate(r.createdAt)} · Actualizada el {fmtDate(r.updatedAt)}{!st.final && r.dueAt ? ` · Respuesta estimada antes del ${fmtDate(r.dueAt)}` : ""}</p>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
