import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PageBody, PageHero } from "@/components/aura/PageHero";
import { InquiryReplyForm } from "@/components/inquiries/InquiryForms";
import { getCurrentCustomer } from "@/lib/customer/auth";
import { INQUIRY_STATUS, TOPICS, tokenMatches } from "@/lib/services/inquiries";
import { prisma } from "@/lib/prisma";

export const metadata: Metadata = { title: "Tu consulta", robots: { index: false, follow: false } };

const fmt = (d: Date) => new Intl.DateTimeFormat("es-CO", { dateStyle: "medium", timeStyle: "short", timeZone: "America/Bogota" }).format(d);

/** Conversación: la ve quien tiene la sesión dueña o el enlace secreto del correo. A nadie más se le confirma que exista. */
export default async function InquiryPage({ params, searchParams }: { params: Promise<{ code: string }>; searchParams: Promise<{ t?: string }> }) {
  const [{ code }, { t }, customer] = await Promise.all([params, searchParams, getCurrentCustomer().catch(() => null)]);
  const q = await prisma.inquiry.findUnique({ where: { code: code.slice(0, 30) }, include: { messages: { orderBy: { createdAt: "asc" } } } });
  const allowed = q && (tokenMatches(t, q.accessHash) || (customer?.emailVerifiedAt && (q.customerId === customer.id || q.email === customer.email)));
  if (!q || !allowed) notFound();
  return (
    <main id="contenido">
      <PageHero quiet eyebrow={`${TOPICS[q.topic]} · ${q.code}`} title={q.subject}>
        <span className="glass-dark rounded-full px-3 py-1 text-xs font-semibold text-gold-light">{INQUIRY_STATUS[q.status]}</span>
      </PageHero>
      <PageBody className="max-w-3xl">
        <ol className="space-y-4" aria-label="Mensajes">
          {q.messages.map((m) => {
            const staff = m.author === "admin";
            return (
              <li key={m.id} className={`flex ${staff ? "justify-start" : "justify-end"}`}>
                <div className={`max-w-[88%] rounded-[22px] px-5 py-4 text-sm leading-6 shadow-soft ${staff ? "bg-ink text-ivory" : "surface"}`}>
                  <p className={`mb-1 text-[11px] font-semibold ${staff ? "text-gold-light" : "text-ink-soft"}`}>{staff ? "7H STORE" : q.name} · {fmt(m.createdAt)}</p>
                  <p className="whitespace-pre-line">{m.body}</p>
                </div>
              </li>
            );
          })}
        </ol>
        {q.status === "CERRADA" ? (
          <p className="surface mt-6 rounded-2xl p-4 text-sm text-ink-soft">Esta consulta está cerrada. Si necesitas algo más, abre una nueva desde Habla con 7H STORE.</p>
        ) : (
          <InquiryReplyForm code={q.code} token={t} />
        )}
      </PageBody>
    </main>
  );
}
