import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentCustomer } from "@/lib/customer/auth";
import { isGoogleConfigured, safeNext } from "@/lib/customer/google";
import { isEmailConfigured } from "@/lib/email";
import { AuthPanel } from "@/components/account/AuthPanel";
import { IsoPackage } from "@/components/orders/IsoPackage";
import { ShieldIcon, TruckIcon } from "@/components/ui/Icons";

export const metadata: Metadata = { title: "Mi cuenta", description: "Entra a tu cuenta 7H STORE para ver tus pedidos, envíos y solicitudes.", robots: { index: false } };

export default async function AccountEntryPage({ searchParams }: { searchParams: Promise<{ next?: string; aviso?: string }> }) {
  const sp = await searchParams;
  if (await getCurrentCustomer()) redirect(safeNext(sp.next));
  return (
    <main id="contenido" className="relative overflow-hidden">
      <div aria-hidden="true" className="iso-grid pointer-events-none absolute inset-x-0 top-0 h-[560px] [mask-image:linear-gradient(to_bottom,black,transparent)]" />
      <div className="relative mx-auto grid max-w-6xl items-center gap-10 px-5 py-12 lg:grid-cols-[1fr_1fr] lg:px-8 lg:py-16">
        <div className="animate-fade-up">
          <p className="inline-flex items-center gap-2 rounded-full border border-gold/40 bg-gold/10 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[.25em]"><ShieldIcon width={14} height={14} /> Mi cuenta</p>
          <h1 className="mt-5 font-display text-5xl leading-[.95] sm:text-6xl">Tus pedidos, en un solo lugar</h1>
          <p className="mt-4 max-w-md text-base leading-7 text-ink-soft">Entra para ver el estado de tus compras y envíos, y para pedir soporte, garantías o devoluciones. Solo tú puedes ver tus pedidos.</p>
          <ul className="mt-6 space-y-2 text-sm text-ink-soft">
            <li className="flex items-center gap-2"><TruckIcon width={16} height={16} className="text-gold" /> Seguimiento sin número de guía</li>
            <li className="flex items-center gap-2"><ShieldIcon width={16} height={16} className="text-gold" /> Solicitudes con radicado y respuesta del equipo</li>
          </ul>
          <IsoPackage className="mt-6 hidden w-full max-w-[340px] drop-shadow-2xl lg:block" />
        </div>
        <AuthPanel next={safeNext(sp.next)} aviso={sp.aviso} googleEnabled={isGoogleConfigured()} otpEnabled={isEmailConfigured()} />
      </div>
    </main>
  );
}
