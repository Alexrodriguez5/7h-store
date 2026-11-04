import type { Metadata } from "next";
import Link from "next/link";
import { PageBody, PageHero } from "@/components/aura/PageHero";
import { NewPostForm } from "@/components/community/CommunityClient";
import { getCurrentCustomer } from "@/lib/customer/auth";
import { CATEGORIES, categoryFromSlug } from "@/lib/services/community";

export const metadata: Metadata = { title: "Nueva publicación", robots: { index: false, follow: true } };

export default async function NewPostPage({ searchParams }: { searchParams: Promise<{ tema?: string }> }) {
  const [{ tema }, customer] = await Promise.all([searchParams, getCurrentCustomer().catch(() => null)]);
  const categories = Object.entries(CATEGORIES).map(([value, label]) => ({ value, label }));
  return (
    <main id="contenido">
      <PageHero quiet eyebrow="Comunidad 7H" title="Nueva" accent="publicación." />
      <PageBody className="max-w-3xl">
        {!customer ? (
          <div className="surface rounded-[28px] p-8 text-center">
            <p className="type-h3">Inicia sesión para publicar</p>
            <p className="mt-2 text-sm text-ink-soft">Así mantenemos la comunidad libre de spam.</p>
            <Link href="/cuenta?next=/comunidad/nueva" className="mt-5 inline-flex rounded-full bg-ink px-6 py-3 text-sm font-semibold text-ivory transition-colors hover:bg-gold hover:text-ink">Iniciar sesión</Link>
          </div>
        ) : !customer.emailVerifiedAt ? (
          <p className="surface rounded-2xl p-5 text-sm">Primero confirma tu correo con el enlace que te enviamos.</p>
        ) : (
          <NewPostForm categories={categories} defaultCategory={categoryFromSlug(tema)} />
        )}
      </PageBody>
    </main>
  );
}
