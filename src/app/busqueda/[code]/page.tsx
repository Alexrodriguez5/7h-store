import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PageBody, PageHero } from "@/components/aura/PageHero";
import { RequestDetail } from "@/components/requests/RequestDetail";
import { getCurrentCustomer } from "@/lib/customer/auth";
import { REQUEST_STATUS } from "@/lib/services/product-requests";
import { canAccess, getCustomerView, syncOffers } from "@/lib/services/special-requests";

export const metadata: Metadata = { title: "Tu búsqueda personalizada", robots: { index: false, follow: false }, referrer: "no-referrer" };

/** Acceso a una solicitud con el enlace seguro del correo (clientes sin cuenta). */
export default async function GuestRequest({ params, searchParams }: { params: Promise<{ code: string }>; searchParams: Promise<{ t?: string }> }) {
  const [{ code }, { t }, customer] = await Promise.all([params, searchParams, getCurrentCustomer().catch(() => null)]);
  await syncOffers().catch(() => undefined);
  const view = await getCustomerView(code.slice(0, 30));
  if (!view || !(await canAccess(view, { customer, token: t }))) notFound();
  return (
    <main id="contenido">
      <PageHero quiet eyebrow={`AURA · Búsqueda personalizada · ${view.code}`} title={view.productName} />
      <PageBody className="max-w-6xl">
        <RequestDetail view={view} statusText={REQUEST_STATUS[view.status].customer} token={t} />
      </PageBody>
    </main>
  );
}
