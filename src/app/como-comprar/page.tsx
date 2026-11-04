import type { Metadata } from "next";
import Link from "next/link";
import { LegalPage } from "@/components/layout/LegalPage";

export const metadata: Metadata = {
  title: "Cómo comprar",
  description: "Compra en 7H STORE en 4 pasos: elige, agrega al carrito, paga con tarjeta, PSE o transferencia y rastrea tu pedido.",
  alternates: { canonical: "/como-comprar" },
};

const STEPS = [
  ["Elige", <>Explora el <Link href="/catalogo" className="underline">catálogo</Link>, usa el buscador o los filtros y selecciona la talla si el producto la tiene.</>],
  ["Agrega al carrito", "Revisa cantidades, subtotal y costo de envío. El carrito se guarda en tu navegador."],
  ["Paga", "Completa tus datos de entrega y elige tarjeta o PSE (a través de Wompi), transferencia o consignación. Las unidades quedan reservadas 24 horas mientras completas el pago."],
  ["Rastrea", <>Entra a <Link href="/cuenta" className="underline">Mi cuenta</Link> con el correo de la compra: verás el estado de pago, el envío y la guía de todos tus pedidos.</>],
] as const;

export default function HowToBuyPage() {
  return (
    <LegalPage eyebrow="Ayuda" title="Comprar es" accent="así de simple." lead="Cuatro pasos, precios finales en pesos colombianos y seguimiento de tu pedido desde tu cuenta." current="/como-comprar">
      <ol className="grid gap-4">
        {STEPS.map(([title, text], i) => (
          <li key={title} className="flex gap-5 rounded-2xl border border-ink/[.07] bg-white/70 p-5 !pl-5 shadow-soft before:!hidden">
            <span className="grid size-11 shrink-0 place-items-center rounded-full bg-ink font-display text-xl text-gold-light">{i + 1}</span>
            <div>
              <h2 className="!text-xl">{title}</h2>
              <p className="mt-1">{text}</p>
            </div>
          </li>
        ))}
      </ol>
    </LegalPage>
  );
}
