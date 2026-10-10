import Image from "next/image";
import Link from "next/link";
import { requireAdminPage } from "@/lib/admin/guard";
import { listProductsAdmin } from "@/lib/services/admin-queries";
import { sortSizes } from "@/lib/sizes";
import { formatCOP } from "@/lib/format";
import { ProductRowActions } from "@/components/admin/ProductRowActions";
import { Badge, EmptyRow, PageHeader, btnPrimary, tdCls, thCls } from "@/components/admin/ui";

export const metadata = { title: "Productos" };

export default async function AdminProductsPage() {
  await requireAdminPage();
  const products = await listProductsAdmin();
  return (
    <>
      <PageHeader title="Productos" subtitle={`${products.length} producto(s) en total.`} action={<Link href="/admin/productos/nuevo" className={btnPrimary}>+ Nuevo producto</Link>} />
      <div className="overflow-x-auto border border-ink/10 bg-white">
        <table className="w-full min-w-[960px]">
          <thead className="border-b border-ink/10"><tr><th className={thCls}>Producto</th><th className={thCls}>Categoría</th><th className={thCls}>Precio</th><th className={thCls}>Stock</th><th className={thCls}>Estado</th><th className={thCls}>Acciones</th></tr></thead>
          <tbody className="divide-y divide-ink/10">
            {products.length === 0 && <EmptyRow cols={6}>Aún no hay productos. Crea el primero.</EmptyRow>}
            {products.map((p) => {
              const soldSizes = sortSizes(p.variants.filter((v) => v.stock === 0).map((v) => v.size));
              return (
                <tr key={p.id} className={p.active ? "" : "bg-ivory-200/40"}>
                  <td className={tdCls}>
                    <div className="flex items-center gap-3">
                      <div className="relative h-14 w-11 shrink-0 overflow-hidden bg-ivory-200">{p.images[0] && <Image src={p.images[0]} alt="" fill unoptimized sizes="44px" className="object-cover" />}</div>
                      <div><p className="font-semibold">{p.name}</p><p className="text-[11px] text-ink-soft">{p.brand}{p.featured && " · Destacado"}</p></div>
                    </div>
                  </td>
                  <td className={tdCls}>{p.category.label}</td>
                  <td className={tdCls}>{formatCOP(p.priceCOP)}</td>
                  <td className={tdCls}>
                    {p.totalStock === 0 ? <Badge tone="error">Agotado</Badge> : <span className="font-semibold">{p.totalStock}</span>}
                    {p.variants.length > 0 && <p className="mt-1 text-[11px] text-ink-soft">{p.variants.length} tallas{soldSizes.length > 0 && ` · agotadas: ${soldSizes.join(", ")}`}</p>}
                  </td>
                  <td className={tdCls}><Badge tone={p.active ? "success" : "neutral"}>{p.active ? "Activo" : "Inactivo"}</Badge></td>
                  <td className={tdCls}><ProductRowActions id={p.id} slug={p.slug} name={p.name} active={p.active} /></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}
