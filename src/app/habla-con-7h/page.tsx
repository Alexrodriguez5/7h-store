import type { Metadata } from "next";
import Link from "next/link";
import { PageBody, PageHero } from "@/components/aura/PageHero";
import { NewInquiryForm } from "@/components/inquiries/InquiryForms";
import { getCurrentCustomer } from "@/lib/customer/auth";
import { INQUIRY_STATUS, TOPICS } from "@/lib/services/inquiries";
import { prisma } from "@/lib/prisma";
import { BUSINESS, whatsappUrl } from "@/lib/business";

export const metadata: Metadata = {
  title: "Habla con 7H STORE",
  description: "Pregúntanos por disponibilidad, tallas, características, envíos, pedidos o garantías. Te respondemos por correo.",
  alternates: { canonical: "/habla-con-7h" },
};

const fmt = (d: Date) => new Intl.DateTimeFormat("es-CO", { day: "numeric", month: "short", timeZone: "America/Bogota" }).format(d);

export default async function TalkPage({ searchParams }: { searchParams: Promise<{ tema?: string; producto?: string; asunto?: string }> }) {
  const [sp, customer] = await Promise.all([searchParams, getCurrentCustomer().catch(() => null)]);
  const mine = customer?.emailVerifiedAt
    ? await prisma.inquiry.findMany({ where: { OR: [{ customerId: customer.id }, { email: customer.email }] }, orderBy: { updatedAt: "desc" }, take: 10, select: { code: true, subject: true, status: true, updatedAt: true } })
    : [];
  const topics = Object.entries(TOPICS).map(([value, label]) => ({ value, label }));
  const topic = sp.tema && sp.tema in TOPICS ? sp.tema : undefined;
  const wa = whatsappUrl(BUSINESS.whatsapp);
  return (
    <main id="contenido">
      <PageHero eyebrow="Habla con 7H STORE" title="Pregúntanos" accent="lo que necesites." lead="Disponibilidad, tallas, características, envíos, pedidos o garantías. Una persona del equipo te responde y la conversación queda guardada." />
      <PageBody className="max-w-6xl">
        <div className="grid gap-8 lg:grid-cols-[1.4fr_1fr]">
          <NewInquiryForm topics={topics} defaults={{ name: customer?.name, email: customer?.email, topic, productSlug: sp.producto?.slice(0, 100), subject: sp.asunto?.slice(0, 120) }} />
          <aside className="space-y-4">
            {mine.length > 0 && (
              <div className="surface rounded-[24px] p-5">
                <p className="type-eyebrow text-gold">Tus consultas</p>
                <ul className="mt-3 divide-y divide-ink/[.07]">
                  {mine.map((q) => (
                    <li key={q.code}>
                      <Link href={`/habla-con-7h/${q.code}`} className="flex items-center justify-between gap-3 py-3 text-sm hover:text-gold">
                        <span className="min-w-0"><span className="block truncate font-medium">{q.subject}</span><span className="text-xs text-ink-soft">{q.code} · {fmt(q.updatedAt)}</span></span>
                        <span className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-semibold ${q.status === "RESPONDIDA" ? "bg-gold text-ink" : "bg-ink/[.06]"}`}>{INQUIRY_STATUS[q.status]}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <div className="surface rounded-[24px] p-5 text-sm leading-6 text-ink-soft">
              <p className="type-eyebrow text-gold">Otros canales</p>
              <ul className="mt-3 space-y-2">
                {wa && <li>WhatsApp: <a href={wa} target="_blank" rel="noreferrer" className="font-semibold text-ink underline-offset-4 hover:underline">+{BUSINESS.whatsapp}</a></li>}
                <li>Instagram: <a href={BUSINESS.instagram.url} target="_blank" rel="noreferrer" className="font-semibold text-ink underline-offset-4 hover:underline">{BUSINESS.instagram.handle}</a></li>
                <li>Garantías y devoluciones con radicado: <Link href="/cuenta/solicitudes" className="font-semibold text-ink underline-offset-4 hover:underline">Mi cuenta</Link></li>
              </ul>
            </div>
          </aside>
        </div>
      </PageBody>
    </main>
  );
}
