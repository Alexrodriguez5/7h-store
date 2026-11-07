import Link from "next/link";
import { notFound } from "next/navigation";
import { requireCustomerPage } from "@/lib/customer/auth";
import { REQUEST_STATUS } from "@/lib/services/product-requests";
import { canAccess, getCustomerView, syncOffers } from "@/lib/services/special-requests";
import { RequestDetail } from "@/components/requests/RequestDetail";

export const metadata = { title: "Mi solicitud" };

export default async function MyRequest({ params }: { params: Promise<{ code: string }> }) {
  const c = await requireCustomerPage();
  const { code } = await params;
  await syncOffers().catch(() => undefined);
  const view = await getCustomerView(code.slice(0, 30));
  // Nunca se confirma que existe una solicitud ajena.
  if (!view || !(await canAccess(view, { customer: c }))) notFound();
  return (
    <div className="space-y-4">
      <Link href="/cuenta/busquedas" className="text-sm underline-offset-4 hover:underline">← Mis solicitudes</Link>
      <h1 className="type-h2">{view.productName}</h1>
      <RequestDetail view={view} statusText={REQUEST_STATUS[view.status].customer} />
    </div>
  );
}
