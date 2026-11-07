import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireCustomerPage } from "@/lib/customer/auth";
import { REQUEST_STATUS } from "@/lib/services/product-requests";
import { Panel } from "@/components/account/ui";

export const metadata = { title: "Mis solicitudes" };

const fmt = (d: Date) => new Intl.DateTimeFormat("es-CO", { day: "numeric", month: "short", year: "numeric", timeZone: "America/Bogota" }).format(d);

/** AURA · Búsqueda personalizada: las solicitudes del cliente (por su cuenta o por el correo verificado). */
export default async function MyRequests() {
  const c = await requireCustomerPage();
  const rows = c.emailVerifiedAt
    ? await prisma.productRequest.findMany({
        where: { OR: [{ customerId: c.id }, { email: c.email }] },
        orderBy: { updatedAt: "desc" },
        take: 50,
        select: { code: true, productName: true, status: true, updatedAt: true, _count: { select: { alternatives: { where: { status: { not: "BORRADOR" } } } } } },
      })
    : [];
  return (
    <Panel>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="type-eyebrow text-gold-deep">AURA · Búsqueda personalizada</p>
          <h1 className="type-h2 mt-2">Mis solicitudes</h1>
          <p className="mt-2 text-sm text-ink-soft">Productos que nos pediste buscar, sus propuestas y tu conversación con el equipo.</p>
        </div>
        <Link href="/tu-lo-buscas" className="rounded-full bg-ink px-5 py-2.5 text-sm font-semibold text-ivory transition-colors hover:bg-gold hover:text-ink">Nueva búsqueda</Link>
      </div>
      {rows.length === 0 ? (
        <p className="mt-8 rounded-2xl bg-ivory-200/60 p-6 text-center text-sm text-ink-soft">Aún no tienes solicitudes. ¿Buscas algo que no está en la tienda? Cuéntanos y lo exploramos.</p>
      ) : (
        <ul className="mt-6 divide-y divide-ink/[.07]">
          {rows.map((r) => (
            <li key={r.code}>
              <Link href={`/cuenta/busquedas/${r.code}`} className="flex flex-wrap items-center justify-between gap-3 py-4 hover:text-gold-deep">
                <span className="min-w-0">
                  <span className="block font-medium">{r.productName}</span>
                  <span className="text-xs text-ink-soft">{r.code} · {fmt(r.updatedAt)}{r._count.alternatives ? ` · ${r._count.alternatives} alternativa(s)` : ""}</span>
                </span>
                <span className={`rounded-full px-3 py-1 text-[11px] font-semibold ${r.status === "ESPERANDO_CLIENTE" ? "bg-gold text-ink" : "bg-ink/[.06]"}`}>{REQUEST_STATUS[r.status].label}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}
