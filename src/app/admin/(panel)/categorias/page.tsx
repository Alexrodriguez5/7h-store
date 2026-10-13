import { requireAdminPage } from "@/lib/admin/guard";
import { listCategoriesAdmin } from "@/lib/services/categories";
import { CategoryManager } from "@/components/admin/CategoryManager";
import { PageHeader } from "@/components/admin/ui";

export const metadata = { title: "Categorías" };

export default async function CategoriesPage() {
  await requireAdminPage();
  const cats = await listCategoriesAdmin();
  return (
    <>
      <PageHeader
        title="Categorías"
        subtitle="Las categorías visibles aparecen automáticamente en el menú, el pie de página, la portada y los filtros. «Todo» no es una categoría: es el filtro general del catálogo."
      />
      <CategoryManager initial={cats.map((c) => ({ id: c.id, slug: c.slug, label: c.label, active: c.active, sortOrder: c.sortOrder, imageUrl: c.imageUrl, productCount: c.productCount, activeProductCount: c.activeProductCount }))} />
    </>
  );
}
