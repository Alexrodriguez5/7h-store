import Link from "next/link";
import type { Prisma, SupportStatus, SupportType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireAdminPage } from "@/lib/admin/guard";
import { SUPPORT_STATUS, SUPPORT_STATUS_ORDER, SUPPORT_TYPES } from "@/lib/support";
import { Badge, EmptyRow, PageHeader, btnGhost, btnPrimary, fmtDate, inputCls, labelCls, tdCls, thCls } from "@/components/admin/ui";

export const metadata = { title: "Solicitudes" };

const PAGE = 30;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

/** Bandeja de solicitudes y garantías: contadores por estado, filtros y vencidas primero. */
export default async function AdminSupportInbox({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const admin = await requireAdminPage();
  const sp = await searchParams;
  const status = one(sp.estado) in SUPPORT_STATUS ? (one(sp.estado) as SupportStatus) : undefined;
  const type = one(sp.tipo) in SUPPORT_TYPES ? (one(sp.tipo) as SupportType) : undefined;
  const q = one(sp.q).trim().slice(0, 100);
  const mine = one(sp.mias) === "1";
  const open = one(sp.abiertas) === "1";
  const page = Math.max(1, Number(one(sp.page)) || 1);

  const finals = SUPPORT_STATUS_ORDER.filter((s) => SUPPORT_STATUS[s].final);
  const where: Prisma.SupportRequestWhereInput = {
    ...(status ? { status } : open ? { status: { notIn: finals } } : {}),
    ...(type ? { type } : {}),
    ...(mine ? { assignedAdminId: admin.id } : {}),
    ...(q ? { OR: [{ code: { contains: q, mode: "insensitive" } }, { contactEmail: { contains: q, mode: "insensitive" } }, { order: { publicCode: { contains: q, mode: "insensitive" } } }, { customer: { name: { contains: q, mode: "insensitive" } } }] } : {}),
  };

  const [counts, total, rows, overdue] = await Promise.all([
    prisma.supportRequest.groupBy({ by: ["status"], _count: { _all: true } }),
    prisma.supportRequest.count({ where }),
    prisma.supportRequest.findMany({
      where, orderBy: [{ updatedAt: "desc" }], skip: (page - 1) * PAGE, take: PAGE,
      select: { code: true, type: true, status: true, reason: true, createdAt: true, updatedAt: true, dueAt: true, contactEmail: true, customer: { select: { name: true } }, order: { select: { publicCode: true } }, assignedAdmin: { select: { name: true } } },
    }),
    prisma.supportRequest.count({ where: { status: { notIn: finals }, dueAt: { lt: new Date() } } }),
  ]);
  const byStatus = Object.fromEntries(counts.map((c) => [c.status, c._count._all])) as Partial<Record<SupportStatus, number>>;
  const openCount = SUPPORT_STATUS_ORDER.filter((s) => !SUPPORT_STATUS[s].final).reduce((n, s) => n + (byStatus[s] ?? 0), 0);
  const pages = Math.max(1, Math.ceil(total / PAGE));

  const link = (patch: Record<string, string | undefined>) => {
    const p = new URLSearchParams();
    const base = { estado: status, tipo: type, q: q || undefined, mias: mine ? "1" : undefined, abiertas: open ? "1" : undefined, ...patch };
    Object.entries(base).forEach(([k, v]) => v && p.set(k, v));
    const s = p.toString();
    return `/admin/solicitudes${s ? `?${s}` : ""}`;
  };
  const filtered = Boolean(status || type || q || mine || open);

  return (
    <>
      <PageHeader title="Solicitudes" subtitle={`${openCount} abierta(s)${overdue ? ` · ${overdue} con plazo vencido` : ""}. Cada caso lo decide una persona del equipo.`} />

      <div className="no-scrollbar mb-5 flex gap-2 overflow-x-auto pb-1 text-xs">
        <Link href={link({ estado: undefined, abiertas: "1", page: undefined })} className={`shrink-0 rounded-full border px-3 py-1.5 font-semibold ${open && !status ? "border-gold bg-gold/15" : "border-ink/15 bg-white"}`}>Abiertas · {openCount}</Link>
        {SUPPORT_STATUS_ORDER.map((s) => (
          <Link key={s} href={link({ estado: status === s ? undefined : s, abiertas: undefined, page: undefined })} className={`shrink-0 rounded-full border px-3 py-1.5 ${status === s ? "border-gold bg-gold/15 font-semibold" : "border-ink/15 bg-white"}`}>
            {SUPPORT_STATUS[s].label} · {byStatus[s] ?? 0}
          </Link>
        ))}
      </div>

      <form method="get" className="mb-6 grid gap-3 rounded-2xl border border-ink/[.07] bg-white p-4 shadow-soft sm:grid-cols-2 lg:grid-cols-[2fr_1fr_auto_auto]">
        {status && <input type="hidden" name="estado" value={status} />}
        <div><label htmlFor="q" className={labelCls}>Buscar</label><input id="q" name="q" defaultValue={q} placeholder="Radicado, pedido, correo o nombre" className={inputCls} /></div>
        <div><label htmlFor="tipo" className={labelCls}>Tipo</label>
          <select id="tipo" name="tipo" defaultValue={type ?? ""} className={inputCls}><option value="">Todos</option>{Object.entries(SUPPORT_TYPES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}</select></div>
        <label className="flex items-end gap-2 pb-2.5 text-xs"><input type="checkbox" name="mias" value="1" defaultChecked={mine} className="size-4 accent-gold" /> Asignadas a mí</label>
        <div className="flex items-end gap-2"><button className={btnPrimary}>Filtrar</button>{filtered && <Link href="/admin/solicitudes" className={btnGhost}>Limpiar</Link>}</div>
      </form>

      <div className="overflow-x-auto rounded-2xl border border-ink/[.07] bg-white shadow-soft">
        <table className="w-full min-w-[960px]">
          <thead className="border-b border-ink/10"><tr>
            <th className={thCls}>Radicado</th><th className={thCls}>Cliente</th><th className={thCls}>Tipo</th><th className={thCls}>Pedido</th><th className={thCls}>Estado</th><th className={thCls}>Responder antes de</th><th className={thCls}>Asignada</th>
          </tr></thead>
          <tbody className="divide-y divide-ink/10">
            {rows.length === 0 && <EmptyRow cols={7}>{filtered ? "No hay solicitudes con esos filtros." : "Todavía no hay solicitudes."}</EmptyRow>}
            {rows.map((r) => {
              const st = SUPPORT_STATUS[r.status];
              const late = !st.final && r.dueAt && r.dueAt < new Date();
              return (
                <tr key={r.code} className="hover:bg-ivory/60">
                  <td className={tdCls}><Link href={`/admin/solicitudes/${r.code}`} className="font-mono font-semibold underline-offset-4 hover:underline">{r.code}</Link><p className="text-[11px] text-ink-soft">{fmtDate(r.createdAt)}</p></td>
                  <td className={tdCls}>{r.customer.name}<p className="text-[11px] text-ink-soft">{r.contactEmail}</p></td>
                  <td className={tdCls}>{SUPPORT_TYPES[r.type].label}<p className="max-w-[220px] truncate text-[11px] text-ink-soft">{r.reason}</p></td>
                  <td className={tdCls}>{r.order.publicCode}</td>
                  <td className={tdCls}><Badge tone={st.tone}>{st.label}</Badge></td>
                  <td className={`${tdCls} ${late ? "font-semibold text-error" : ""}`}>{r.dueAt && !st.final ? `${fmtDate(r.dueAt).split(",")[0]}${late ? " (vencida)" : ""}` : "—"}</td>
                  <td className={tdCls}>{r.assignedAdmin?.name ?? <span className="text-ink-soft">Sin asignar</span>}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {pages > 1 && (
        <nav aria-label="Paginación" className="mt-6 flex items-center justify-between text-xs">
          {page > 1 ? <Link href={link({ page: String(page - 1) })} className={btnGhost}>← Anterior</Link> : <span />}
          <span className="text-ink-soft">Página {page} de {pages}</span>
          {page < pages ? <Link href={link({ page: String(page + 1) })} className={btnGhost}>Siguiente →</Link> : <span />}
        </nav>
      )}
    </>
  );
}
