import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { TrackingForm } from "@/components/orders/TrackingForm";
import { IsoPackage } from "@/components/orders/IsoPackage";
import { ShieldIcon, TruckIcon } from "@/components/ui/Icons";

export const metadata: Metadata = {
  title: "Sigue tu pedido",
  description: "Consulta el estado de tu compra en 7H STORE y conoce cómo avanza su entrega.",
  alternates: { canonical: "/pedidos" },
};

export default function OrdersPage() {
  return (
    <main id="contenido" className="relative overflow-hidden">
      <div aria-hidden="true" className="iso-grid pointer-events-none absolute inset-x-0 top-0 h-[560px] [mask-image:linear-gradient(to_bottom,black,transparent)]" />
      <div aria-hidden="true" className="pointer-events-none absolute -right-40 top-10 size-[480px] rounded-full bg-gold/10 blur-3xl" />

      <div className="relative mx-auto max-w-6xl px-5 py-12 lg:px-8 lg:py-16">
        <div className="grid items-center gap-10 lg:grid-cols-[1.1fr_.9fr]">
          <div className="animate-fade-up">
            <p className="inline-flex items-center gap-2 rounded-full border border-gold/40 bg-gold/10 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[.25em] text-ink">
              <TruckIcon width={14} height={14} /> Seguimiento de pedidos
            </p>
            <h1 className="mt-5 font-display text-5xl leading-[.95] sm:text-6xl">Sigue tu pedido</h1>
            <p className="mt-4 max-w-lg text-base leading-7 text-ink-soft">Consulta el estado de tu compra y conoce cómo avanza su entrega.</p>
            <ul className="mt-6 flex flex-wrap gap-x-6 gap-y-2 text-xs text-ink-soft">
              <li className="flex items-center gap-2"><ShieldIcon width={16} height={16} className="text-gold" /> Consulta privada con tu correo</li>
              <li className="flex items-center gap-2"><TruckIcon width={16} height={16} className="text-gold" /> Guía y transportadora en un solo lugar</li>
            </ul>
          </div>
          <IsoPackage className="mx-auto w-full max-w-[360px] drop-shadow-2xl lg:max-w-[420px]" />
        </div>

        <div className="mx-auto mt-8 max-w-3xl lg:-mt-6">
          <Suspense fallback={<div className="h-72 animate-pulse rounded-3xl bg-white/60" />}>
            <TrackingForm />
          </Suspense>
          <p className="mt-8 text-center text-sm text-ink-soft">
            ¿Tienes dudas sobre tu compra?{" "}
            <Link href="/contacto" className="font-semibold text-ink underline-offset-4 hover:text-gold hover:underline">Contáctanos</Link>
          </p>
        </div>
      </div>
    </main>
  );
}
