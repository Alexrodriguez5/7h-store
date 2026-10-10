import Link from "next/link";
import { requireAdminPage } from "@/lib/admin/guard";
import { LOW_STOCK_THRESHOLD, listProductsAdmin } from "@/lib/services/admin-queries";
import { sortSizes } from "@/lib/sizes";
import { InventoryRow } from "@/components/admin/InventoryRow";
import { Badge, EmptyRow, PageHeader, btnGhost, btnPrimary, tdCls, thCls } from "@/components/admin/ui";

export const metadata = { title: "Inventario" };
const FILTERS = [["", "Todos"], ["agotados", "Agotados"], ["bajo", "Bajo stock"]] as const;

export default async function InventoryPage({ searchParams }: { searchParams: Promise<{ f?: string }> }) {
  await requireAdminPage();
  const { f } = await searchParams;
  const all = await listProductsAdmin();
  const low = (p: (typeof all)[number]) => p.totalStock > 0 && (p.totalStock <= LOW_STOCK_THRESHOLD || p.variants.some((v) => v.stock > 0 && v.stock <= 1));
  const rows = f === "agotados" ? all.filter((p) => p.totalStock === 0) : f === "bajo" ? all.filter(low) : all;

  return (
    <>
      <PageHeader title="Inventario" subtitle="Ajusta el stock real (conteo físico). Los pedidos pendientes ya tienen sus unidades reservadas." />
      <div className="mb-5 flex flex-wrap gap-2">
        {FILTERS.map(([key, label]) => <Link key={key} href={key ? `/admin/inventario?f=${key}` : "/admin/inventario"} className={(f ?? "") === key ? btnPrimary : btnGhost}>{label}</Link>)}
      </div>
      <div className="overflow-x-auto border border-ink/10 bg-white">
        <table className="w-full min-w-[760px]">
          <thead className="border-b border-ink/10"><tr><th className={thCls}>Producto</th><th className={thCls}>Total</th><th className={thCls}>Stock por talla</th></tr></thead>
          <tbody className="divide-y divide-ink/10">
            {rows.length === 0 && <EmptyRow cols={3}>{f === "agotados" ? "No hay productos agotados." : f === "bajo" ? "No hay productos con bajo stock." : "No hay productos."}</EmptyRow>}
            {rows.map((p) => (
              <tr key={p.id}>
                <td className={tdCls}><Link href={`/admin/productos/${p.id}/editar`} className="font-semibold underline-offset-4 hover:underline">{p.name}</Link><p className="text-[11px] text-ink-soft">{p.brand} · {p.active ? "Activo" : "Inactivo"}</p></td>
                <td className={tdCls}>{p.totalStock === 0 ? <Badge tone="error">Agotado</Badge> : low(p) ? <Badge tone="warning">{p.totalStock} · Bajo</Badge> : <span className="font-semibold">{p.totalStock}</span>}</td>
                <td className={tdCls}>
                  <InventoryRow key={`${p.id}-${p.totalStock}`} productId={p.id} stock={p.stock}
                    variants={sortSizes(p.variants.map((v) => v.size)).map((s) => p.variants.find((v) => v.size === s)!).map((v) => ({ id: v.id, size: v.size, stock: v.stock }))} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
