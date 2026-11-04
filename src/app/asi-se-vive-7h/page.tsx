import type { Metadata } from "next";
import { PageBody, PageHero } from "@/components/aura/PageHero";
import { GalleryGrid } from "@/components/gallery/GalleryGrid";
import { ShareForm } from "@/components/gallery/ShareForm";
import { getCurrentCustomer } from "@/lib/customer/auth";
import { getPublicMedia } from "@/lib/services/gallery";
import { prisma } from "@/lib/prisma";

export const metadata: Metadata = {
  title: "Así se vive 7H",
  description: "Fotos y videos de productos 7H STORE y de clientes que compartieron su compra.",
  alternates: { canonical: "/asi-se-vive-7h" },
};

export default async function GalleryPage() {
  const [items, customer] = await Promise.all([getPublicMedia({ take: 48 }), getCurrentCustomer().catch(() => null)]);
  const own = customer
    ? await prisma.mediaItem.findMany({ where: { customerId: customer.id, withdrawnAt: null }, orderBy: { createdAt: "desc" }, take: 9, select: { id: true, status: true, caption: true } })
    : [];
  return (
    <main id="contenido">
      <PageHero eyebrow="Así se vive 7H" title="Productos reales," accent="en manos reales." lead="Fotos y videos de lo que vendemos y de clientes que quisieron compartir su compra. Cada foto de un cliente se publica solo con su autorización." />
      <PageBody>
        <div className="grid gap-8 lg:grid-cols-[1fr_320px]">
          <div>
            {items.length > 0 ? (
              <GalleryGrid items={items} />
            ) : (
              <div className="surface rounded-[28px] px-6 py-16 text-center">
                <p className="type-h3">La galería está empezando.</p>
                <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-ink-soft">Pronto verás aquí fotos de nuestros productos y de clientes. ¿Ya recibiste tu pedido? Sé de los primeros en compartirlo.</p>
              </div>
            )}
          </div>
          <aside className="lg:sticky lg:top-28 lg:h-fit">
            <ShareForm loggedIn={!!customer} verified={!!customer?.emailVerifiedAt} own={own} />
          </aside>
        </div>
      </PageBody>
    </main>
  );
}
