import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { getCurrentCustomer } from "@/lib/customer/auth";
import { AccountNav } from "@/components/account/AccountNav";

export const metadata = { robots: { index: false, follow: false } };

/** Área privada del cliente: toda página aquí exige sesión (se valida en el servidor). */
export default async function PrivateAccountLayout({ children }: { children: ReactNode }) {
  const c = await getCurrentCustomer();
  if (!c) redirect("/cuenta");
  return (
    <main id="contenido" className="relative overflow-hidden">
      <div aria-hidden="true" className="iso-grid pointer-events-none absolute inset-x-0 top-0 h-80 [mask-image:linear-gradient(to_bottom,black,transparent)]" />
      <div className="relative mx-auto grid max-w-6xl gap-8 px-5 py-10 lg:grid-cols-[240px_1fr] lg:px-8 lg:py-14">
        <AccountNav name={c.name} email={c.email} avatarUrl={c.avatarUrl} />
        <div className="min-w-0 space-y-6">
          {!c.emailVerifiedAt && (
            <div role="status" className="rounded-2xl border border-gold/40 bg-gold/10 p-4 text-sm">
              Confirma tu correo con el enlace que te enviamos para ver tus pedidos y crear solicitudes.
            </div>
          )}
          {children}
        </div>
      </div>
    </main>
  );
}
