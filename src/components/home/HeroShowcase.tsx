import Image from "next/image";
import Link from "next/link";
import { formatCOP } from "@/lib/format";
import type { Product } from "@/types";

/**
 * Composición del hero con productos REALES del catálogo (fotos, nombre y precio vienen de la base de datos).
 * Se elige, si existe, uno por cada línea de la tienda (moda, accesorios, tecnología) para comunicar
 * de un vistazo qué se vende. Si no hay productos, no se muestra nada inventado.
 */
export function pickShowcase(featured: Product[], all: Product[]): Product[] {
  const pool = [...featured, ...all].filter((p, i, a) => p.images[0] && p.stock > 0 && a.findIndex((x) => x.id === p.id) === i);
  const order = [["calzado", "ropa"], ["accesorios"], ["tecnologia"]];
  const picked: Product[] = [];
  for (const cats of order) {
    const hit = pool.find((p) => cats.includes(p.category) && !picked.includes(p));
    if (hit) picked.push(hit);
  }
  for (const p of pool) if (picked.length < 3 && !picked.includes(p)) picked.push(p);
  return picked.slice(0, 3);
}

function Tile({ p, priority, className, sizes, label }: { p: Product; priority?: boolean; className: string; sizes: string; label: string }) {
  return (
    <Link href={`/producto/${p.slug}`} className={`group relative block overflow-hidden rounded-[22px] bg-[#16140f] ${className}`}>
      <Image src={p.images[0]} alt={p.name} fill priority={priority} sizes={sizes} className="object-cover transition-transform duration-700 ease-out will-change-transform group-hover:scale-[1.04]" />
      <span aria-hidden="true" className="absolute inset-x-0 bottom-0 h-2/5 bg-gradient-to-t from-ink/80 to-transparent" />
      <span className="absolute inset-x-3 bottom-3 flex flex-col items-start gap-1.5 text-ivory sm:inset-x-4 sm:bottom-4 sm:flex-row sm:items-end sm:justify-between sm:gap-2">
        <span className="w-full min-w-0 sm:w-auto">
          <span className="block text-[9px] font-semibold uppercase tracking-[.24em] text-gold-light">{label}</span>
          <span className="mt-0.5 block truncate text-[13px] font-medium sm:text-sm">{p.name}</span>
        </span>
        <span className="shrink-0 rounded-full bg-ivory px-2.5 py-1 text-[11px] font-semibold tabular-nums text-ink">{formatCOP(p.priceCOP)}</span>
      </span>
    </Link>
  );
}

export function HeroShowcase({ products, labels }: { products: Product[]; labels: Record<string, string> }) {
  if (products.length === 0) return null;
  const [a, b, c] = products;
  const lab = (p: Product) => labels[p.category] ?? p.brand;
  return (
    <div className="grid h-[clamp(320px,96vw,440px)] grid-cols-[1.25fr_1fr] grid-rows-2 gap-2.5 sm:h-[520px] sm:gap-4 lg:h-[min(600px,68svh)]">
      <Tile p={a} priority label={lab(a)} className={b ? "row-span-2" : "col-span-2 row-span-2"} sizes="(min-width:1024px) 30vw, 56vw" />
      {b && <Tile p={b} label={lab(b)} className={c ? "" : "row-span-2"} sizes="(min-width:1024px) 22vw, 44vw" />}
      {c && <Tile p={c} label={lab(c)} className="" sizes="(min-width:1024px) 22vw, 44vw" />}
    </div>
  );
}
