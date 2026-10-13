import Link from "next/link";
import type { Category } from "@/types";

export function Footer({ categories }: { categories: Category[] }) {
  return (
    <footer className="mt-20 bg-ink text-ivory">
      <div className="mx-auto grid max-w-7xl gap-10 px-5 py-14 sm:grid-cols-2 lg:grid-cols-4 lg:px-8">
        <div className="sm:col-span-2">
          <p className="font-display text-3xl tracking-widest text-gold-light">7H STORE</p>
          <p className="mt-2 font-display text-xl">Calidad. Estilo. Confianza.</p>
          <p className="mt-3 max-w-md text-xs leading-6 text-ivory/60">
            Productos importados de EE.UU. con precios en COP, impuestos incluidos y seguimiento de
            cada pedido.
          </p>
        </div>
        <div>
          <h2 className="text-xs font-semibold uppercase tracking-widest text-gold-light">
            Tienda
          </h2>
          <div className="mt-4 flex flex-col gap-3 text-xs text-ivory/70">
            <Link href="/catalogo" className="hover:text-gold-light">
              Todo
            </Link>
            {categories.map((c) => (
              <Link
                key={c.slug}
                href={`/catalogo?categoria=${encodeURIComponent(c.slug)}`}
                className="hover:text-gold-light"
              >
                {c.label}
              </Link>
            ))}
          </div>
        </div>
        <div>
          <h2 className="text-xs font-semibold uppercase tracking-widest text-gold-light">Ayuda</h2>
          <div className="mt-4 flex flex-col gap-3 text-xs text-ivory/70">
            <Link href="/envios">Envíos</Link>
            <Link href="/devoluciones">Devoluciones</Link>
            <Link href="/como-comprar">Cómo comprar</Link>
            <Link href="/pedidos">Rastrear pedido</Link>
            <Link href="/contacto">Contacto</Link>
            <Link href="/terminos">Términos y condiciones</Link>
            <Link href="/privacidad">Política de privacidad</Link>
          </div>
        </div>
      </div>
      <div className="border-t border-white/10 px-5 py-5 text-center text-[10px] tracking-wider text-ivory/60">
        Pagos: tarjeta · PSE · transferencia · consignación · © {new Date().getFullYear()} 7H STORE
      </div>
    </footer>
  );
}
