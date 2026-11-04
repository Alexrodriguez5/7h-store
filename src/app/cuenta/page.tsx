import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentCustomer } from "@/lib/customer/auth";
import { isGoogleConfigured, safeNext } from "@/lib/customer/google";
import { isEmailConfigured } from "@/lib/email";
import { AuthPanel } from "@/components/account/AuthPanel";
import { AuraParticles, AuraVisual } from "@/components/aura/AuraVisual";
import { ShieldIcon, TruckIcon } from "@/components/ui/Icons";

export const metadata: Metadata = { title: "Mi cuenta", description: "Entra a tu cuenta 7H STORE para ver tus pedidos, envíos y solicitudes.", robots: { index: false } };

export default async function AccountEntryPage({ searchParams }: { searchParams: Promise<{ next?: string; aviso?: string; modo?: string }> }) {
  const sp = await searchParams;
  if (await getCurrentCustomer()) redirect(safeNext(sp.next));
  return (
    <main id="contenido" className="aura-bg grain relative isolate overflow-hidden text-ivory">
      <AuraParticles count={12} />
      {/* El Aura 3D detrás del panel de vidrio: la refracción del vidrio se nota sobre la esfera */}
      <AuraVisual className="pointer-events-none absolute -right-[18%] top-[6%] -z-0 aspect-square w-[70vw] max-w-[720px] opacity-80 lg:right-[2%] lg:w-[46vw]" />
      <div className="relative mx-auto grid max-w-6xl items-center gap-10 px-5 py-12 lg:min-h-[calc(100svh-8rem)] lg:grid-cols-[1fr_minmax(0,480px)] lg:px-8 lg:py-16">
        <div className="animate-fade-up">
          <p className="inline-flex items-center gap-2 rounded-full border border-gold/30 bg-white/5 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[.3em] text-gold-light backdrop-blur"><ShieldIcon width={14} height={14} /> Acceso seguro</p>
          <h1 className="mt-5 font-display text-5xl leading-[.95] sm:text-7xl">Tus pedidos, <span className="text-aura italic">en un solo lugar.</span></h1>
          <p className="mt-5 max-w-md text-base leading-7 text-ivory/65">Entra para ver el estado de tus compras y envíos, y para pedir soporte, garantías o devoluciones. Solo tú puedes ver tus pedidos.</p>
          <ul className="mt-7 grid max-w-md gap-2 text-sm text-ivory/75">
            <li className="glass-dark flex items-center gap-3 rounded-2xl px-4 py-3"><TruckIcon width={18} height={18} className="text-gold-light" /> Seguimiento sin número de guía</li>
            <li className="glass-dark flex items-center gap-3 rounded-2xl px-4 py-3"><ShieldIcon width={18} height={18} className="text-gold-light" /> Solicitudes con radicado y respuesta del equipo</li>
          </ul>
        </div>
        <AuthPanel next={safeNext(sp.next)} aviso={sp.aviso} register={sp.modo === "registro"} googleEnabled={isGoogleConfigured()} otpEnabled={isEmailConfigured()} />
      </div>
    </main>
  );
}
