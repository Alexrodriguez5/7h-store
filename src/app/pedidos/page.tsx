import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentCustomer } from "@/lib/customer/auth";
import { ORDER_CODE_RE, normalizeOrderCode } from "@/lib/order-tracking";
import { IsoPackage } from "@/components/orders/IsoPackage";
import { ShieldIcon, TruckIcon } from "@/components/ui/Icons";
import { PageBody, PageHero } from "@/components/aura/PageHero";
import { Button } from "@/components/ui/Button";

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
    <main id="contenido">
      <PageHero
        eyebrow="Seguimiento de pedidos"
        title="Sigue tu"
        accent="pedido."
        lead="Inicia sesión con el correo que usaste en la compra y verás todos tus pedidos, su estado de pago, la transportadora y la guía."
      >
        {code && ORDER_CODE_RE.test(code) && <p className="mb-4 text-sm text-ivory/80">Pedido <strong className="font-mono text-gold-light">{code}</strong>: al entrar te llevamos directo a él.</p>}
        <div className="flex flex-wrap gap-3">
          <Button href={login} variant="gold">Iniciar sesión para ver mis pedidos</Button>
          <Button href={`${login}&modo=registro`} variant="secondary" className="border-ivory/30 text-ivory hover:border-gold hover:bg-white/5">Crear cuenta</Button>
        </div>
      </PageHero>
      <PageBody className="max-w-6xl">
        <div className="surface grid items-center gap-8 rounded-[28px] p-7 sm:p-10 lg:grid-cols-[1.1fr_.9fr]">
          <ul className="space-y-5 text-sm leading-6 text-ink-soft">
            <li className="flex gap-4">
              <span className="grid size-11 shrink-0 place-items-center rounded-full bg-ink text-gold-light"><ShieldIcon width={20} height={20} /></span>
              <span><strong className="block text-ink">Solo tú ves tus pedidos</strong>Nadie puede consultarlos con tu número de pedido.</span>
            </li>
            <li className="flex gap-4">
              <span className="grid size-11 shrink-0 place-items-center rounded-full bg-ink text-gold-light"><TruckIcon width={20} height={20} /></span>
              <span><strong className="block text-ink">¿Compraste sin cuenta?</strong>Entra con el mismo correo y tus compras aparecen solas.</span>
            </li>
          </ul>
          <IsoPackage className="mx-auto w-full max-w-[300px] drop-shadow-2xl" />
        </div>
        <p className="mt-10 text-center text-sm text-ink-soft">
          ¿Tienes dudas sobre tu compra?{" "}
          <Link href="/contacto" className="font-semibold text-ink underline-offset-4 hover:text-gold hover:underline">Contáctanos</Link>
        </p>
      </PageBody>
    </main>
  );
}
