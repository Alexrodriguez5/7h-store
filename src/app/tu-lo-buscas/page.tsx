import type { Metadata } from "next";
import Link from "next/link";
import { PageBody, PageHero } from "@/components/aura/PageHero";
import { AuraAssistant } from "@/components/requests/AuraAssistant";
import { getCurrentCustomer } from "@/lib/customer/auth";

export const metadata: Metadata = {
  title: "AURA · Búsqueda personalizada",
  description: "¿No encuentras un producto en 7H STORE? Cuéntanos qué necesitas, con fotos o enlaces, y te prepararemos alternativas con precio y tiempos confirmados.",
  alternates: { canonical: "/tu-lo-buscas" },
};

const STEPS = [
  ["Nos cuentas", "Lo que necesitas, con tus palabras. Una foto o un enlace ayudan, pero no son obligatorios."],
  ["Buscamos", "Revisamos proveedores, disponibilidad, precio final en pesos y tiempos de llegada."],
  ["Te proponemos", "Una o varias alternativas. Tú eliges, preguntas o nos dices que ninguna te sirve."],
  ["Compras seguro", "Si aceptas, te preparamos una oferta privada para pagar en el checkout de siempre."],
];

export default async function ProductRequestPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const [{ q }, customer] = await Promise.all([searchParams, getCurrentCustomer().catch(() => null)]);
  return (
    <main id="contenido">
      <PageHero
        eyebrow="AURA · Búsqueda personalizada"
        title="Tú lo necesitas."
        accent="Nosotros buscamos cómo conseguirlo."
        lead="¿No está en la tienda? Cuéntanos qué buscas y nuestro equipo explorará las posibilidades de conseguirlo para ti."
      />
      <PageBody className="max-w-6xl">
        <div className="grid gap-8 lg:grid-cols-[1.4fr_1fr]">
          <AuraAssistant defaults={{ name: customer?.name, email: customer?.email, productName: q?.slice(0, 160) }} />
          <aside className="space-y-4">
            <ol className="surface space-y-5 rounded-[28px] p-6 sm:p-8">
              {STEPS.map(([t, d], i) => (
                <li key={t} className="flex gap-4">
                  <span className="grid size-10 shrink-0 place-items-center rounded-full bg-ink font-display text-lg text-gold-light">{i + 1}</span>
                  <span><strong className="block text-sm">{t}</strong><span className="text-sm leading-6 text-ink-soft">{d}</span></span>
                </li>
              ))}
            </ol>
            <p className="px-2 text-xs leading-5 text-ink-soft">No todos los productos se pueden conseguir: depende de la marca, la disponibilidad y las condiciones de importación. No confirmamos precio, disponibilidad ni fecha de entrega hasta verificarlos con el proveedor.</p>
            {customer && <p className="px-2 text-xs text-ink-soft">Sigue tus búsquedas en <Link href="/cuenta/busquedas" className="underline">Mis solicitudes</Link>.</p>}
          </aside>
        </div>
      </PageBody>
    </main>
  );
}
