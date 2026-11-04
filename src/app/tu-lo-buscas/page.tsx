import type { Metadata } from "next";
import { PageBody, PageHero } from "@/components/aura/PageHero";
import { ProductRequestForm } from "@/components/requests/ProductRequestForm";
import { getCurrentCustomer } from "@/lib/customer/auth";

export const metadata: Metadata = {
  title: "Tú lo buscas. Nosotros lo exploramos",
  description: "¿No encuentras un producto en 7H STORE? Cuéntanos qué buscas y exploraremos la posibilidad de conseguirlo.",
  alternates: { canonical: "/tu-lo-buscas" },
};

const STEPS = [
  ["Nos cuentas", "Qué producto buscas, la marca, el modelo y, si quieres, una foto o un enlace."],
  ["Exploramos", "Revisamos disponibilidad, precio final en pesos y tiempos de llegada."],
  ["Te respondemos", "Por correo, con una respuesta clara: si se puede o no, y en qué condiciones."],
];

export default async function ProductRequestPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const [{ q }, customer] = await Promise.all([searchParams, getCurrentCustomer().catch(() => null)]);
  return (
    <main id="contenido">
      <PageHero
        eyebrow="Tú lo buscas"
        title="Tú lo buscas."
        accent="Nosotros lo exploramos."
        lead="Cuéntanos qué producto estás buscando. En 7H STORE queremos acercarte lo que necesitas: déjanos tu solicitud y exploraremos las posibilidades de conseguirlo."
      />
      <PageBody className="max-w-6xl">
        <div className="grid gap-8 lg:grid-cols-[1.4fr_1fr]">
          <ProductRequestForm defaults={{ name: customer?.name, email: customer?.email, productName: q?.slice(0, 120) }} />
          <aside className="space-y-4">
            <ol className="surface space-y-5 rounded-[28px] p-6 sm:p-8">
              {STEPS.map(([t, d], i) => (
                <li key={t} className="flex gap-4">
                  <span className="grid size-10 shrink-0 place-items-center rounded-full bg-ink font-display text-lg text-gold-light">{i + 1}</span>
                  <span><strong className="block text-sm">{t}</strong><span className="text-sm leading-6 text-ink-soft">{d}</span></span>
                </li>
              ))}
            </ol>
            <p className="px-2 text-xs leading-5 text-ink-soft">No todos los productos se pueden conseguir: depende de la marca, la disponibilidad y las condiciones de importación. Te responderemos siempre con honestidad.</p>
          </aside>
        </div>
      </PageBody>
    </main>
  );
}
