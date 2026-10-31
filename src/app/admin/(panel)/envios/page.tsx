import { requireAdminPage } from "@/lib/admin/guard";
import { listShippingZonesAdmin } from "@/lib/services/shipping-zones";
import { ShippingZoneManager } from "@/components/admin/ShippingZoneManager";
import { PageHeader } from "@/components/admin/ui";

export const metadata = { title: "Envíos" };

export default async function ShippingPage() {
  await requireAdminPage();
  const zones = await listShippingZonesAdmin();
  return (
    <>
      <PageHeader
        title="Envíos"
        subtitle="Tarifas y plazos por zona. El checkout cobra según el departamento de entrega y el peso del pedido (precio base + valor por kg adicional). Las compras desde $500.000 tienen envío gratis."
      />
      <ShippingZoneManager
        initial={zones.map((z) => ({ id: z.id, name: z.name, departments: z.departments, priceCOP: z.priceCOP, baseWeightGrams: z.baseWeightGrams, extraPerKgCOP: z.extraPerKgCOP, minDays: z.minDays, maxDays: z.maxDays, active: z.active, sortOrder: z.sortOrder }))}
      />
    </>
  );
}
