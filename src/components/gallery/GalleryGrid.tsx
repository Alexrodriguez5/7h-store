import Link from "next/link";
import type { PublicMedia } from "@/lib/services/gallery";
import { ProductVideo } from "@/components/product/ProductVideo";

/**
 * Galería "Así se vive 7H": fotos y videos aprobados. Los videos no se descargan hasta que se reproducen;
 * las fotos usan carga diferida. Cada pieza dice de dónde viene (7H STORE o un cliente con su alias).
 */
export function GalleryGrid({ items }: { items: PublicMedia[] }) {
  return (
    <ul className="columns-2 gap-3 sm:columns-3 sm:gap-4 lg:columns-4 [&>li]:mb-3 sm:[&>li]:mb-4">
      {items.map((m) => (
        <li key={m.id} className="break-inside-avoid overflow-hidden rounded-[22px] bg-ink">
          {m.kind === "VIDEO" ? (
            <ProductVideo url={m.src} name={m.caption ?? "7H STORE"} />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={m.src} alt={m.caption ?? (m.product ? m.product.name : "Foto de 7H STORE")} loading="lazy" decoding="async" className="block w-full object-cover" />
          )}
          {(m.caption || m.displayName || m.product) && (
            <div className="space-y-1 px-4 py-3 text-ivory">
              {m.caption && <p className="text-sm leading-5">{m.caption}</p>}
              <p className="text-[11px] text-ivory/55">
                {m.source === "customer" ? `Compartido por ${m.displayName ?? "un cliente"}` : "7H STORE"}
                {m.product && <> · <Link href={`/producto/${m.product.slug}`} className="text-gold-light underline-offset-2 hover:underline">{m.product.name}</Link></>}
              </p>
            </div>
          )}
        </li>
      ))}
    </ul>
  );
}
