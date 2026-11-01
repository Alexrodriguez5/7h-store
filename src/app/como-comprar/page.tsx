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
  ["Rastrea", <>Guarda tu número de pedido y consulta su estado en <Link href="/pedidos" className="underline">Rastrear pedido</Link>.</>],
] as const;

export default function HowToBuyPage() {
  return (
    <LegalPage eyebrow="Ayuda" title="Cómo comprar">
      <ol className="!space-y-4">
        {STEPS.map(([title, text], i) => (
          <li key={title} className="!ml-0 flex !list-none gap-4 rounded-2xl border border-ink/10 bg-white/50 p-5">
            <span className="grid size-9 shrink-0 place-items-center rounded-full bg-gold/20 font-semibold text-ink">{i + 1}</span>
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
