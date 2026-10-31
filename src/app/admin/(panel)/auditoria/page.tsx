import Link from "next/link";
import { requireAdminPage } from "@/lib/admin/guard";
import { prisma } from "@/lib/prisma";
import { AUDIT_LABEL } from "@/lib/admin/audit";
import { EmptyRow, PageHeader, btnGhost, fmtDate, tdCls, thCls } from "@/components/admin/ui";

export const metadata = { title: "Auditoría" };
const PAGE = 50;

const ENTITY_LINK: Record<string, (id: string) => string> = {
  order: (id) => `/admin/pedidos/${id}`,
  product: (id) => `/admin/productos/${id}/editar`,
};

export default async function AuditPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  await requireAdminPage();
  const page = Math.max(1, Math.min(1000, Number((await searchParams).page) || 1));
  const [total, rows] = await Promise.all([
    prisma.adminAuditLog.count(),
    prisma.adminAuditLog.findMany({ orderBy: { createdAt: "desc" }, skip: (page - 1) * PAGE, take: PAGE }),
  ]);
  const pages = Math.max(1, Math.ceil(total / PAGE));
  return (
    <>
      <PageHeader title="Auditoría" subtitle="Quién hizo qué y cuándo: accesos, cambios de productos, inventario, categorías, pedidos y cuentas." />
      <div className="overflow-x-auto rounded-2xl border border-ink/[.07] bg-white shadow-soft">
        <table className="w-full min-w-[860px]">
          <thead className="border-b border-ink/10"><tr><th className={thCls}>Fecha</th><th className={thCls}>Acción</th><th className={thCls}>Quién</th><th className={thCls}>Detalle</th><th className={thCls}>IP</th></tr></thead>
          <tbody className="divide-y divide-ink/10">
            {rows.length === 0 && <EmptyRow cols={5}>Aún no hay registros.</EmptyRow>}
            {rows.map((r) => {
              const link = r.entityType && r.entityId ? ENTITY_LINK[r.entityType]?.(r.entityId) : undefined;
              const details = r.details && typeof r.details === "object" ? Object.entries(r.details as Record<string, unknown>).map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(", ") : String(v)}`).join(" · ") : "";
              return (
                <tr key={r.id} className={r.action === "auth.login_failed" ? "bg-error/5" : ""}>
                  <td className={`${tdCls} whitespace-nowrap text-xs`}>{fmtDate(r.createdAt)}</td>
                  <td className={tdCls}>{AUDIT_LABEL[r.action] ?? r.action}</td>
                  <td className={`${tdCls} text-xs`}>{r.actorEmail ?? "—"}</td>
                  <td className={`${tdCls} max-w-md text-xs text-ink-soft`}>{link ? <Link href={link} className="underline">{details || "Ver"}</Link> : details || "—"}</td>
                  <td className={`${tdCls} font-mono text-[11px]`}>{r.ip ?? "—"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {pages > 1 && (
        <nav aria-label="Paginación" className="mt-6 flex items-center justify-between text-xs">
          {page > 1 ? <Link href={`/admin/auditoria?page=${page - 1}`} className={btnGhost}>← Más recientes</Link> : <span />}
          <span className="text-ink-soft">Página {page} de {pages}</span>
          {page < pages ? <Link href={`/admin/auditoria?page=${page + 1}`} className={btnGhost}>Más antiguos →</Link> : <span />}
        </nav>
      )}
    </>
  );
}
