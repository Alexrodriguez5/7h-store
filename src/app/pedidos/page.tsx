import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentCustomer } from "@/lib/customer/auth";
import { ORDER_CODE_RE, normalizeOrderCode } from "@/lib/order-tracking";
import { IsoPackage } from "@/components/orders/IsoPackage";
import { ShieldIcon, TruckIcon } from "@/components/ui/Icons";

export const metadata: Metadata = {
  title: "Sigue tu pedido",
  description: "Inicia sesión en 7H STORE para ver el estado de tus compras y cómo avanza su entrega.",
  alternates: { canonical: "/pedidos" },
};

/**
 * Rastreo de pedidos: exige iniciar sesión. Con sesión, lleva directo a Mis pedidos (o al pedido indicado en ?codigo=).
 * Los pedidos hechos como invitado aparecen al entrar con el mismo correo de la compra.
 */
export default async function OrdersPage({ searchParams }: { searchParams: Promise<{ codigo?: string }> }) {
  const { codigo } = await searchParams;
  const code = codigo ? normalizeOrderCode(codigo) : "";
  const target = ORDER_CODE_RE.test(code) ? `/cuenta/pedidos/${code}` : "/cuenta/pedidos";
  if (await getCurrentCustomer()) redirect(target);
  const login = `/cuenta?next=${encodeURIComponent(target)}`;

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
            <p className="mt-4 max-w-lg text-base leading-7 text-ink-soft">
              Inicia sesión con el correo que usaste en la compra y verás todos tus pedidos, su estado de pago, la transportadora y la guía.
            </p>
            {code && ORDER_CODE_RE.test(code) && <p className="mt-3 text-sm">Pedido <strong className="font-mono">{code}</strong>: al entrar te llevamos directo a él.</p>}
            <div className="mt-7 flex flex-wrap gap-3">
              <Link href={login} className="inline-flex items-center justify-center rounded-full bg-gold px-7 py-3.5 text-sm font-semibold text-ink shadow-soft transition-all hover:bg-gold-light hover:shadow-lift">
                Iniciar sesión para ver mis pedidos
              </Link>
              <Link href={`${login}&modo=registro`} className="inline-flex items-center justify-center rounded-full border border-ink/20 bg-white/60 px-6 py-3.5 text-sm font-semibold transition-colors hover:border-gold">
                Crear cuenta
              </Link>
            </div>
            <ul className="mt-7 space-y-2 text-xs text-ink-soft">
              <li className="flex items-center gap-2"><ShieldIcon width={16} height={16} className="text-gold" /> Solo tú ves tus pedidos: nadie puede consultarlos con tu número de pedido.</li>
              <li className="flex items-center gap-2"><TruckIcon width={16} height={16} className="text-gold" /> ¿Compraste sin cuenta? Entra con el mismo correo y tus compras aparecen solas.</li>
            </ul>
          </div>
          <IsoPackage className="mx-auto w-full max-w-[360px] drop-shadow-2xl lg:max-w-[420px]" />
        </div>
        <p className="mt-10 text-center text-sm text-ink-soft">
          ¿Tienes dudas sobre tu compra?{" "}
          <Link href="/contacto" className="font-semibold text-ink underline-offset-4 hover:text-gold hover:underline">Contáctanos</Link>
        </p>
      </div>
    </main>
  );
}
