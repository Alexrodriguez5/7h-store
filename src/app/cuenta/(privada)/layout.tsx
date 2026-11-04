import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { getCurrentCustomer } from "@/lib/customer/auth";
import { AccountNav } from "@/components/account/AccountNav";
import { AuraParticles } from "@/components/aura/AuraVisual";
import { prisma } from "@/lib/prisma";
import { customerOrdersWhere } from "@/lib/services/support";

export const metadata = { robots: { index: false, follow: false } };

/** Área privada del cliente: toda página aquí exige sesión (se valida en el servidor). */
export default async function PrivateAccountLayout({ children }: { children: ReactNode }) {
  const c = await getCurrentCustomer();
  if (!c) redirect("/cuenta");
  // Resumen del encabezado (consultas en serie: una sola conexión por servidor).
  const where = customerOrdersWhere(c);
  const orders = await prisma.order.count({ where });
  const inTransit = await prisma.order.count({ where: { ...where, status: { in: ["PAID", "PROCESSING", "SHIPPED"] } } });
  const openRequests = await prisma.supportRequest.count({ where: { customerId: c.id, status: { notIn: ["FINALIZADA", "NO_APROBADA"] } } });
  const first = c.name.split(" ")[0] || "Hola";
  const since = new Intl.DateTimeFormat("es-CO", { month: "long", year: "numeric", timeZone: "America/Bogota" }).format(c.createdAt);
  const stats = [
    { label: "Pedidos", value: orders },
    { label: "En camino", value: inTransit },
    { label: "Solicitudes abiertas", value: openRequests },
  ];

  return (
    <main id="contenido" className="ivory-aura relative overflow-hidden">
      {/* Encabezado de la cuenta, con el estilo de la marca */}
      <section className="aura-bg grain relative isolate overflow-hidden rounded-b-[36px] text-ivory">
        <AuraParticles count={8} />
        <div className="mx-auto flex max-w-6xl flex-col gap-8 px-5 py-10 lg:flex-row lg:items-end lg:justify-between lg:px-8 lg:py-14">
          <div className="flex items-center gap-5">
            {c.avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={c.avatarUrl} alt="" width={72} height={72} referrerPolicy="no-referrer" className="size-16 rounded-full object-cover ring-2 ring-gold/70 sm:size-[72px]" />
            ) : (
              <span className="grid size-16 place-items-center rounded-full bg-gold font-sans text-2xl font-semibold text-ink sm:size-[72px]">{first.charAt(0).toUpperCase()}</span>
            )}
            <div className="min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-[.3em] text-gold-light">Mi cuenta 7H</p>
              <p className="mt-1 truncate font-display text-4xl leading-none sm:text-6xl">Hola, <span className="italic text-aura">{first}</span></p>
              <p className="mt-1 text-xs text-ivory/60">Cliente desde {since} · {c.email}</p>
            </div>
          </div>
          <dl className="grid grid-cols-3 gap-3 sm:gap-4">
            {stats.map((s) => (
              <div key={s.label} className="glass-dark rounded-2xl px-4 py-3 sm:min-w-32">
                <dt className="text-[10px] uppercase tracking-widest text-ivory/55">{s.label}</dt>
                <dd className="mt-1 font-display text-3xl tabular-nums text-gold-light sm:text-4xl">{s.value}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      <div className="relative mx-auto grid max-w-6xl gap-8 px-5 py-10 lg:grid-cols-[220px_1fr] lg:px-8 lg:py-12">
        <AccountNav />
        <div className="min-w-0 space-y-6">
          {!c.emailVerifiedAt && (
            <div role="status" className="rounded-2xl border border-gold/40 bg-gold/10 p-4 text-sm">
              Confirma tu correo con el enlace que te enviamos para ver tus pedidos y crear solicitudes.
            </div>
          )}
          {children}
        </div>
      </div>
    </main>
  );
}
