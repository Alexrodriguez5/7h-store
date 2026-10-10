import { requireAdminPage } from "@/lib/admin/guard";
import { prisma } from "@/lib/prisma";
import { CategoryRename } from "@/components/admin/CategoryRename";
import { PageHeader, tdCls, thCls } from "@/components/admin/ui";

export const metadata = { title: "Categorías" };

export default async function CategoriesPage() {
  await requireAdminPage();
  const cats = await prisma.category.findMany({ include: { _count: { select: { products: true } } }, orderBy: { label: "asc" } });
  return (
    <>
      <PageHeader title="Categorías" subtitle="Las 4 categorías forman parte del menú y las URLs de la tienda. Aquí puedes cambiar el nombre visible. “Todo” no es una categoría: es el filtro del catálogo." />
      <div className="overflow-x-auto border border-ink/10 bg-white">
        <table className="w-full min-w-[520px]">
          <thead className="border-b border-ink/10"><tr><th className={thCls}>Slug</th><th className={thCls}>Nombre visible</th><th className={thCls}>Productos</th></tr></thead>
          <tbody className="divide-y divide-ink/10">
            {cats.map((c) => (
              <tr key={c.id}><td className={`${tdCls} font-mono text-xs`}>{c.slug}</td><td className={tdCls}><CategoryRename id={c.id} label={c.label} /></td><td className={tdCls}>{c._count.products}</td></tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
