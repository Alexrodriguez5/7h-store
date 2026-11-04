import { requireAdminPage } from "@/lib/admin/guard";
import { EMPTY_PRODUCT, ProductForm } from "@/components/admin/ProductForm";
import { PageHeader } from "@/components/admin/ui";
import { listCategoryOptions } from "@/lib/services/categories";
import { prisma } from "@/lib/prisma";

export const metadata = { title: "Nuevo producto" };

/** Con ?solicitud=<id> el formulario parte de una solicitud de "Tú lo buscas" y la enlaza al guardar. */
export default async function NewProductPage({ searchParams }: { searchParams: Promise<{ solicitud?: string }> }) {
  await requireAdminPage();
  const { solicitud } = await searchParams;
  const [categories, request] = await Promise.all([
    listCategoryOptions(),
    solicitud ? prisma.productRequest.findUnique({ where: { id: solicitud.slice(0, 40) }, select: { id: true, code: true, productName: true, brand: true, model: true } }) : null,
  ]);
  const initial = request ? { ...EMPTY_PRODUCT, name: request.productName, brand: request.brand ?? "", model: request.model ?? "" } : undefined;
  return (
    <>
      <PageHeader title="Nuevo producto" subtitle={request ? `A partir de la solicitud ${request.code}. Completa precio, fotos e inventario reales antes de publicarlo.` : "Al guardarlo aparecerá automáticamente en el catálogo si está activo."} />
      <ProductForm categories={categories} initial={initial} fromRequestId={request?.id} />
    </>
  );
}
