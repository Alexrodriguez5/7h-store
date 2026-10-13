import { requireAdminPage } from "@/lib/admin/guard";
import { ProductForm } from "@/components/admin/ProductForm";
import { PageHeader } from "@/components/admin/ui";
import { listCategoryOptions } from "@/lib/services/categories";

export const metadata = { title: "Nuevo producto" };

export default async function NewProductPage() {
  await requireAdminPage();
  const categories = await listCategoryOptions();
  return (
    <>
      <PageHeader title="Nuevo producto" subtitle="Al guardarlo aparecerá automáticamente en el catálogo si está activo." />
      <ProductForm categories={categories} />
    </>
  );
}
