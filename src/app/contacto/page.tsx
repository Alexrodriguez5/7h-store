import type { Metadata } from "next";
import { BUSINESS, whatsappUrl } from "@/lib/business";

export const metadata: Metadata = {
  title: "Contacto",
  description: "Escríbenos para resolver dudas sobre productos, disponibilidad, pedidos y garantías de 7H STORE.",
  alternates: { canonical: "/contacto" },
};

/** Solo se muestran los canales configurados (src/lib/business.ts); nunca datos inventados. */
export default function ContactoPage() {
  const wa = whatsappUrl(BUSINESS.whatsapp);
  const channels = [
    { label: "Instagram", value: BUSINESS.instagram.handle, href: BUSINESS.instagram.url, text: "Novedades, disponibilidad y atención por mensaje directo." },
    wa && { label: "WhatsApp", value: `+${BUSINESS.whatsapp}`, href: wa, text: "Escríbenos para dudas sobre productos y pedidos." },
    BUSINESS.email && { label: "Correo", value: BUSINESS.email, href: `mailto:${BUSINESS.email}`, text: "Pedidos, garantías, devoluciones y PQR." },
  ].filter(Boolean) as { label: string; value: string; href: string; text: string }[];

  return (
    <main id="contenido" className="mx-auto min-h-[60vh] max-w-5xl px-5 py-16 lg:px-8 lg:py-20">
      <p className="text-[10px] font-semibold uppercase tracking-widest text-gold">Atención al cliente</p>
      <h1 className="mt-2 font-display text-5xl leading-tight">Contacto</h1>
      <p className="mt-5 max-w-2xl text-base leading-7 text-ink-soft">
        Te ayudamos con disponibilidad, pedidos, envíos y garantías. Ten a mano tu número de pedido si ya compraste.
      </p>

      <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {channels.map((c) => (
          <a
            key={c.label}
            href={c.href}
            target={c.href.startsWith("http") ? "_blank" : undefined}
            rel="noreferrer"
            className="group block rounded-2xl border border-ink/10 bg-white/50 p-6 shadow-soft transition-all hover:-translate-y-0.5 hover:border-gold hover:shadow-lift"
          >
            <p className="text-xs font-semibold uppercase tracking-[0.15em] text-gold">{c.label}</p>
            <h2 className="mt-3 break-all font-display text-2xl">{c.value}</h2>
            <p className="mt-3 text-sm text-ink-soft">{c.text}</p>
          </a>
        ))}
      </div>
    </main>
  );
}
