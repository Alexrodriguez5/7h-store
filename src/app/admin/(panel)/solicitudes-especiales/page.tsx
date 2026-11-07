import Link from "next/link";
import type { Prisma, ProductRequestStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireAdminPage } from "@/lib/admin/guard";
import { formatCOP } from "@/lib/format";
import { OPEN_STATUSES, REQUEST_STATUS, REQUEST_STATUS_ORDER } from "@/lib/services/product-requests";
import { syncOffers } from "@/lib/services/special-requests";
import { RankBars } from "@/components/admin/charts";
import { Badge, Card, EmptyRow, PageHeader, Stat, btnGhost, btnPrimary, fmtDate, inputCls, labelCls, tdCls, thCls } from "@/components/admin/ui";

export const metadata = { title: "Solicitudes especiales" };

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";
const PAGE = 40;

/** Estados que se muestran como indicadores arriba (lo que pidió el negocio). */
const KPIS: { label: string; statuses: ProductRequestStatus[] }[] = [
  { label: "Nuevas", statuses: ["NUEVA"] },
  { label: "En revisión", statuses: ["EN_REVISION"] },
  { label: "En investigación", statuses: ["BUSCANDO_PROVEEDORES"] },
  { label: "En cotización", statuses: ["COTIZANDO", "PROPUESTA_PREPARADA"] },
  { label: "Propuestas enviadas", statuses: ["PROPUESTA_ENVIADA"] },
  { label: "Esperando respuesta", statuses: ["ESPERANDO_CLIENTE"] },
  { label: "Aceptadas", statuses: ["ACEPTADA", "DISPONIBLE"] },
  { label: "Rechazadas", statuses: ["RECHAZADA"] },
  { label: "Cerradas", statuses: ["CERRADA", "CONVERTIDA", "NO_DISPONIBLE", "FINALIZADA"] },
];

const tone = (s: ProductRequestStatus) => (s === "CONVERTIDA" ? "success" : s === "ACEPTADA" ? "gold" : OPEN_STATUSES.includes(s) ? "warning" : "neutral") as "success" | "gold" | "warning" | "neutral";

/**
 * Solicitudes especiales: CRM de oportunidades de AURA · Búsqueda personalizada.
 * Independiente de los pedidos y del inventario: aquí no se cobra nada.
 */
export default async function SpecialRequests({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requireAdminPage();
  await syncOffers().catch(() => undefined); // pedidos pagados → "Convertida en compra"
  const sp = await searchParams;
  const view = one(sp.vista) === "analitica" ? "analitica" : "lista";
  const status = (REQUEST_STATUS_ORDER as string[]).includes(one(sp.estado)) ? (one(sp.estado) as ProductRequestStatus) : undefined;
  const open = one(sp.estado) === "abiertas";
  const q = one(sp.q).trim().slice(0, 80);
  const owner = one(sp.responsable).slice(0, 40);
  const from = one(sp.desde);
  const to = one(sp.hasta);
  const minB = Number(one(sp.min)) || undefined;
  const maxB = Number(one(sp.max)) || undefined;
  const page = Math.max(1, Number(one(sp.page)) || 1);

  const where: Prisma.ProductRequestWhereInput = {
    ...(status ? { status } : open ? { status: { in: OPEN_STATUSES } } : {}),
    ...(q ? { OR: [{ code: { contains: q, mode: "insensitive" } }, { name: { contains: q, mode: "insensitive" } }, { email: { contains: q, mode: "insensitive" } }, { productName: { contains: q, mode: "insensitive" } }, { brand: { contains: q, mode: "insensitive" } }, { model: { contains: q, mode: "insensitive" } }] } : {}),
    ...(owner ? { assignedAdminId: owner === "ninguno" ? null : owner } : {}),
    ...(from || to ? { createdAt: { ...(from ? { gte: new Date(`${from}T00:00:00-05:00`) } : {}), ...(to ? { lte: new Date(`${to}T23:59:59-05:00`) } : {}) } } : {}),
    ...(minB || maxB ? { budgetCOP: { ...(minB ? { gte: minB } : {}), ...(maxB ? { lte: maxB } : {}) } } : {}),
  };

  // Consultas en serie: el servidor usa una sola conexión a la base de datos.
  const counts = await prisma.productRequest.groupBy({ by: ["status"], _count: { _all: true } });
  const admins = await prisma.adminUser.findMany({ where: { active: true }, select: { id: true, name: true }, orderBy: { name: "asc" } });
  const total = await prisma.productRequest.count({ where });
  const rows = view === "lista"
    ? await prisma.productRequest.findMany({ where, orderBy: { updatedAt: "desc" }, skip: (page - 1) * PAGE, take: PAGE, select: { id: true, code: true, name: true, email: true, productName: true, brand: true, budgetCOP: true, status: true, createdAt: true, updatedAt: true, assignedAdminId: true, _count: { select: { images: true, alternatives: true } } } })
    : [];
  const byStatus = Object.fromEntries(counts.map((c) => [c.status, c._count._all])) as Partial<Record<ProductRequestStatus, number>>;
  const adminName = new Map(admins.map((a) => [a.id, a.name]));
  const link = (patch: Record<string, string | undefined>) => {
    const p = new URLSearchParams();
    Object.entries({ vista: view === "analitica" ? "analitica" : undefined, estado: status ?? (open ? "abiertas" : undefined), q: q || undefined, responsable: owner || undefined, desde: from || undefined, hasta: to || undefined, min: minB ? String(minB) : undefined, max: maxB ? String(maxB) : undefined, ...patch }).forEach(([k, v]) => v && p.set(k, v));
    const s = p.toString();
    return `/admin/solicitudes-especiales${s ? `?${s}` : ""}`;
  };
  const pages = Math.max(1, Math.ceil(total / PAGE));

  return (
    <>
      <PageHeader
        title="Solicitudes especiales"
        subtitle="AURA · Búsqueda personalizada. Oportunidades comerciales: investiga, cotiza, propone y convierte. Aquí no se cobra nada; la venta se confirma solo cuando el pedido queda pagado."
        action={
          <div className="flex gap-2">
            <Link href={link({ vista: undefined })} className={view === "lista" ? btnPrimary : btnGhost}>Solicitudes</Link>
            <Link href={link({ vista: "analitica" })} className={view === "analitica" ? btnPrimary : btnGhost}>Analítica</Link>
          </div>
        }
      />

      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5 xl:grid-cols-9">
        {KPIS.map((k) => (
          <Stat key={k.label} label={k.label} value={k.statuses.reduce((n, s) => n + (byStatus[s] ?? 0), 0)} href={k.statuses.length === 1 ? link({ estado: k.statuses[0], page: undefined }) : undefined} />
        ))}
      </div>

      {view === "analitica" ? (
        <Analytics />
      ) : (
        <>
          <form className="mb-5 grid gap-3 rounded-2xl border border-ink/[.07] bg-white p-4 shadow-soft sm:grid-cols-2 lg:grid-cols-7" action="/admin/solicitudes-especiales">
            <div className="lg:col-span-2"><label className={labelCls} htmlFor="q">Buscar</label><input id="q" name="q" defaultValue={q} placeholder="Radicado, cliente, producto o marca" className={inputCls} /></div>
            <div><label className={labelCls} htmlFor="estado">Estado</label>
              <select id="estado" name="estado" defaultValue={status ?? (open ? "abiertas" : "")} className={inputCls}>
                <option value="">Todos</option><option value="abiertas">Abiertas</option>
                {REQUEST_STATUS_ORDER.map((s) => <option key={s} value={s}>{REQUEST_STATUS[s].label}</option>)}
              </select></div>
            <div><label className={labelCls} htmlFor="responsable">Responsable</label>
              <select id="responsable" name="responsable" defaultValue={owner} className={inputCls}>
                <option value="">Todos</option><option value="ninguno">Sin asignar</option>
                {admins.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select></div>
            <div><label className={labelCls} htmlFor="desde">Desde</label><input id="desde" name="desde" type="date" defaultValue={from} className={inputCls} /></div>
            <div><label className={labelCls} htmlFor="hasta">Hasta</label><input id="hasta" name="hasta" type="date" defaultValue={to} className={inputCls} /></div>
            <div className="flex items-end gap-2">
              <div className="flex-1"><label className={labelCls} htmlFor="min">Presupuesto</label><div className="flex gap-1"><input id="min" name="min" inputMode="numeric" defaultValue={minB} placeholder="mín" className={inputCls} /><input name="max" inputMode="numeric" defaultValue={maxB} placeholder="máx" aria-label="Presupuesto máximo" className={inputCls} /></div></div>
            </div>
            <div className="flex gap-2 sm:col-span-2 lg:col-span-7">
              <button type="submit" className={btnPrimary}>Filtrar</button>
              <Link href="/admin/solicitudes-especiales" className={btnGhost}>Limpiar</Link>
              <span className="ml-auto self-center text-xs text-ink-soft">{total} resultado(s)</span>
            </div>
          </form>

          <div className="overflow-x-auto rounded-2xl border border-ink/[.07] bg-white shadow-soft">
            <table className="w-full min-w-[900px]">
              <thead className="border-b border-ink/10"><tr><th className={thCls}>Radicado</th><th className={thCls}>Producto</th><th className={thCls}>Cliente</th><th className={thCls}>Presupuesto</th><th className={thCls}>Estado</th><th className={thCls}>Responsable</th><th className={thCls}>Actualizada</th></tr></thead>
              <tbody className="divide-y divide-ink/10">
                {rows.length === 0 && <EmptyRow cols={7}>No hay solicitudes con estos filtros.</EmptyRow>}
                {rows.map((r) => (
                  <tr key={r.id} className="hover:bg-ivory/40">
                    <td className={tdCls}><Link href={`/admin/solicitudes-especiales/${r.code}`} className="font-mono text-xs font-semibold underline-offset-2 hover:underline">{r.code}</Link></td>
                    <td className={tdCls}><p className="font-medium">{r.productName}</p><p className="text-[11px] text-ink-soft">{r.brand ?? "Sin marca"} · {r._count.images} foto(s) · {r._count.alternatives} alternativa(s)</p></td>
                    <td className={tdCls}><p>{r.name}</p><p className="text-[11px] text-ink-soft">{r.email}</p></td>
                    <td className={tdCls}>{r.budgetCOP ? formatCOP(r.budgetCOP) : "—"}</td>
                    <td className={tdCls}><Badge tone={tone(r.status)}>{REQUEST_STATUS[r.status].label}</Badge></td>
                    <td className={tdCls}>{r.assignedAdminId ? adminName.get(r.assignedAdminId) ?? "—" : <span className="text-ink-soft">Sin asignar</span>}</td>
                    <td className={tdCls}>{fmtDate(r.updatedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {pages > 1 && (
            <div className="mt-4 flex justify-end gap-2 text-xs">
              {page > 1 && <Link href={link({ page: String(page - 1) })} className={btnGhost}>Anterior</Link>}
              <span className="self-center">Página {page} de {pages}</span>
              {page < pages && <Link href={link({ page: String(page + 1) })} className={btnGhost}>Siguiente</Link>}
            </div>
          )}
        </>
      )}
    </>
  );
}

/** Analítica: qué piden los clientes, cuánto tardamos en responder y cuánto convertimos. Solo datos reales. */
async function Analytics() {
  const all = await prisma.productRequest.findMany({ select: { productName: true, brand: true, budgetCOP: true, status: true, createdAt: true, firstResponseAt: true, closeReason: true, alternatives: { select: { status: true, sentAt: true } } } });
  const words = new Map<string, number>();
  const brands = new Map<string, number>();
  const reasons = new Map<string, number>();
  const buckets = [
    { label: "Menos de $300.000", max: 300_000 }, { label: "$300.000 – $1.000.000", max: 1_000_000 }, { label: "$1.000.000 – $3.000.000", max: 3_000_000 }, { label: "Más de $3.000.000", max: Infinity },
  ].map((b) => ({ ...b, value: 0 }));
  const STOP = new Set(["de", "la", "el", "los", "las", "un", "una", "para", "con", "en", "y", "o", "del"]);
  let responseMs = 0, responded = 0, sent = 0, accepted = 0, converted = 0;
  for (const r of all) {
    if (r.brand) brands.set(r.brand.trim().toLowerCase(), (brands.get(r.brand.trim().toLowerCase()) ?? 0) + 1);
    for (const w of r.productName.toLowerCase().split(/[^a-záéíóúñü0-9]+/).filter((x) => x.length > 2 && !STOP.has(x))) words.set(w, (words.get(w) ?? 0) + 1);
    if (r.budgetCOP) buckets.find((b) => r.budgetCOP! <= b.max)!.value++;
    if (r.firstResponseAt) { responseMs += r.firstResponseAt.getTime() - r.createdAt.getTime(); responded++; }
    if (r.alternatives.some((a) => a.sentAt)) sent++;
    if (r.alternatives.some((a) => a.status === "ACEPTADA") || ["ACEPTADA", "CONVERTIDA"].includes(r.status)) accepted++;
    if (r.status === "CONVERTIDA") converted++;
    if ((r.status === "NO_DISPONIBLE" || r.status === "RECHAZADA") && r.closeReason) reasons.set(r.closeReason.slice(0, 80), (reasons.get(r.closeReason.slice(0, 80)) ?? 0) + 1);
  }
  const top = (m: Map<string, number>) => [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8).map(([label, value]) => ({ label, value }));
  const hours = responded ? Math.round(responseMs / responded / 3_600_000) : null;
  const pct = (a: number, b: number) => (b ? `${Math.round((a / b) * 100)} %` : "—");
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <Stat label="Solicitudes recibidas" value={all.length} />
        <Stat label="Primera respuesta (promedio)" value={hours === null ? "—" : hours < 48 ? `${hours} h` : `${Math.round(hours / 24)} días`} />
        <Stat label="Con propuesta enviada" value={sent} />
        <Stat label="Propuestas aceptadas" value={`${accepted} · ${pct(accepted, sent)}`} />
        <Stat label="Convertidas en compra" value={`${converted} · ${pct(converted, all.length)}`} />
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="Productos más buscados (palabras)"><RankBars unit="count" rows={top(words)} empty="Aún no hay solicitudes." /></Card>
        <Card title="Marcas más solicitadas"><RankBars unit="count" rows={top(brands)} empty="Aún no hay marcas registradas." /></Card>
        <Card title="Presupuestos frecuentes"><RankBars unit="count" rows={buckets.filter((b) => b.value > 0).map((b) => ({ label: b.label, value: b.value }))} empty="Nadie ha indicado presupuesto todavía." /></Card>
        <Card title="Motivos de no disponible o rechazo"><RankBars unit="count" rows={top(reasons)} empty="Sin motivos registrados." /></Card>
      </div>
      <p className="text-xs text-ink-soft">Las categorías se deducen de las palabras del producto (la solicitud no tiene categoría propia). Úsalo para decidir qué incorporar al catálogo.</p>
    </div>
  );
}
