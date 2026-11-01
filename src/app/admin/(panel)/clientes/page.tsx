import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireAdminPage } from "@/lib/admin/guard";
import { Badge, EmptyRow, PageHeader, btnGhost, btnPrimary, fmtDate, inputCls, labelCls, tdCls, thCls } from "@/components/admin/ui";

export const metadata = { title: "Clientes" };

const PAGE = 30;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

/** Clientes con cuenta. Los compradores invitados siguen apareciendo en Pedidos; al crear cuenta con el mismo correo ven sus compras. */
export default async function AdminCustomersPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requireAdminPage();
  const sp = await searchParams;
  const q = one(sp.q).trim().slice(0, 100);
  const filter = one(sp.filtro);
  const page = Math.max(1, Number(one(sp.page)) || 1);
  const where: Prisma.CustomerWhereInput = {
    ...(q ? { OR: [{ email: { contains: q, mode: "insensitive" } }, { name: { contains: q, mode: "insensitive" } }, { phone: { contains: q } }] } : {}),
    ...(filter === "bloqueados" ? { blockedAt: { not: null } } : filter === "supresion" ? { deletionRequestedAt: { not: null } } : filter === "sin-verificar" ? { emailVerifiedAt: null } : {}),
  };
  const [total, rows] = await Promise.all([
    prisma.customer.count({ where }),
    prisma.customer.findMany({
      where, orderBy: { createdAt: "desc" }, skip: (page - 1) * PAGE, take: PAGE,
      select: { id: true, name: true, email: true, phone: true, createdAt: true, emailVerifiedAt: true, blockedAt: true, deletionRequestedAt: true, identities: { select: { provider: true } }, _count: { select: { supportRequests: true } } },
    }),
  ]);
  const orderCounts = rows.length
    ? await prisma.order.groupBy({ by: ["customerEmail"], where: { customerEmail: { in: rows.map((r) => r.email) } }, _count: { _all: true } })
    : [];
  const ordersBy = new Map(orderCounts.map((o) => [o.customerEmail.toLowerCase(), o._count._all]));
  const pages = Math.max(1, Math.ceil(total / PAGE));
  const qs = (patch: Record<string, string | undefined>) => {
    const p = new URLSearchParams();
    Object.entries({ q: q || undefined, filtro: filter || undefined, ...patch }).forEach(([k, v]) => v && p.set(k, v));
    const s = p.toString();
    return `/admin/clientes${s ? `?${s}` : ""}`;
  };

  return (
    <>
      <PageHeader title="Clientes" subtitle={`${total} cliente(s) con cuenta.`} />
      <form method="get" className="mb-6 grid gap-3 rounded-2xl border border-ink/[.07] bg-white p-4 shadow-soft sm:grid-cols-[2fr_1fr_auto]">
        <div><label htmlFor="q" className={labelCls}>Buscar</label><input id="q" name="q" defaultValue={q} placeholder="Nombre, correo o celular" className={inputCls} /></div>
        <div><label htmlFor="filtro" className={labelCls}>Mostrar</label>
          <select id="filtro" name="filtro" defaultValue={filter} className={inputCls}>
            <option value="">Todos</option><option value="sin-verificar">Correo sin verificar</option><option value="bloqueados">Bloqueados</option><option value="supresion">Pidieron supresión de datos</option>
          </select></div>
        <div className="flex items-end gap-2"><button className={btnPrimary}>Filtrar</button>{(q || filter) && <Link href="/admin/clientes" className={btnGhost}>Limpiar</Link>}</div>
      </form>

      <div className="overflow-x-auto rounded-2xl border border-ink/[.07] bg-white shadow-soft">
        <table className="w-full min-w-[860px]">
          <thead className="border-b border-ink/10"><tr>
            <th className={thCls}>Cliente</th><th className={thCls}>Ingreso</th><th className={thCls}>Pedidos</th><th className={thCls}>Solicitudes</th><th className={thCls}>Estado</th><th className={thCls}>Desde</th>
          </tr></thead>
          <tbody className="divide-y divide-ink/10">
            {rows.length === 0 && <EmptyRow cols={6}>{q || filter ? "No hay clientes con esos filtros." : "Todavía no hay clientes con cuenta."}</EmptyRow>}
            {rows.map((c) => (
              <tr key={c.id} className="hover:bg-ivory/60">
                <td className={tdCls}><Link href={`/admin/clientes/${c.id}`} className="font-semibold underline-offset-4 hover:underline">{c.name}</Link><p className="text-[11px] text-ink-soft">{c.email}{c.phone ? ` · ${c.phone}` : ""}</p></td>
                <td className={tdCls}><div className="flex flex-wrap gap-1">{c.identities.map((i) => <Badge key={i.provider}>{i.provider === "google" ? "Google" : i.provider === "password" ? "Contraseña" : "Código"}</Badge>)}</div></td>
                <td className={tdCls}>{ordersBy.get(c.email.toLowerCase()) ?? 0}</td>
                <td className={tdCls}>{c._count.supportRequests}</td>
                <td className={tdCls}>
                  <div className="flex flex-wrap gap-1">
                    {c.blockedAt ? <Badge tone="error">Bloqueado</Badge> : c.emailVerifiedAt ? <Badge tone="success">Verificado</Badge> : <Badge tone="warning">Sin verificar</Badge>}
                    {c.deletionRequestedAt && <Badge tone="warning">Supresión</Badge>}
                  </div>
                </td>
                <td className={tdCls}>{fmtDate(c.createdAt).split(",")[0]}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {pages > 1 && (
        <nav aria-label="Paginación" className="mt-6 flex items-center justify-between text-xs">
          {page > 1 ? <Link href={qs({ page: String(page - 1) })} className={btnGhost}>← Anterior</Link> : <span />}
          <span className="text-ink-soft">Página {page} de {pages}</span>
          {page < pages ? <Link href={qs({ page: String(page + 1) })} className={btnGhost}>Siguiente →</Link> : <span />}
        </nav>
      )}
    </>
  );
}
