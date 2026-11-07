import Link from "next/link";
import { Logo } from "@/components/brand/Logo";
import type { Category } from "@/types";

export function Footer({ categories }: { categories: Category[] }) {
  return (
    <footer className="section-ink relative isolate overflow-hidden border-t border-gold/15 text-ivory">
      <div className="mx-auto grid max-w-7xl gap-10 px-5 py-14 sm:grid-cols-2 lg:grid-cols-4 lg:px-8">
        <div className="sm:col-span-2">
          <Logo size="lg" />
          <p className="mt-5 font-display text-2xl tracking-tight">Calidad. Estilo. Confianza.</p>
          <p className="mt-3 max-w-md text-xs leading-6 text-ivory/60">
            Productos seleccionados, precios claros en pesos colombianos, pagos seguros y seguimiento
            de cada pedido. Comprar no debería ser complicado.
          </p>
        </div>
        <div>
          <h2 className="text-xs font-semibold uppercase tracking-widest text-gold-light">
            Tienda
          </h2>
          <div className="mt-4 flex flex-col gap-3 text-xs text-ivory/70">
            <Link href="/catalogo" className="transition-colors hover:text-gold-light">
              Todo
            </Link>
            {categories.map((c) => (
              <Link
                key={c.slug}
                href={`/catalogo?categoria=${encodeURIComponent(c.slug)}`}
                className="transition-colors hover:text-gold-light"
              >
                {c.label}
              </Link>
            ))}
          </div>
        </div>
        <div>
          <h2 className="text-xs font-semibold uppercase tracking-widest text-gold-light">Ayuda</h2>
          <div className="mt-4 flex flex-col gap-3 text-xs text-ivory/70 [&_a]:transition-colors [&_a:hover]:text-gold-light">
            <Link href="/envios">Envíos</Link>
            <Link href="/devoluciones">Devoluciones</Link>
            <Link href="/como-comprar">Cómo comprar</Link>
            <Link href="/preguntas-frecuentes">Preguntas frecuentes</Link>
            <Link href="/pedidos">Rastrear pedido</Link>
            <Link href="/habla-con-7h">Habla con 7H STORE</Link>
            <Link href="/tu-lo-buscas">Búsqueda personalizada</Link>
            <Link href="/comunidad">Comunidad 7H</Link>
            <Link href="/asi-se-vive-7h">Así se vive 7H</Link>
            <Link href="/contacto">Contacto</Link>
            <Link href="/nosotros">Sobre 7H STORE</Link>
            <Link href="/terminos">Términos y condiciones</Link>
            <Link href="/privacidad">Política de privacidad</Link>
          </div>
        </div>
      </div>
      <div className="border-t border-white/10 px-5 py-5 text-center text-[10px] tracking-wider text-ivory/60">
        <p>Pagos: tarjeta · PSE · transferencia · consignación · © {new Date().getFullYear()} 7H STORE</p>
        <p className="mt-2">
          {/* Solo la marca. Los datos del proveedor que exige la ley (art. 50, Ley 1480) están en Términos. */}
          <Link href="/terminos#vendedor" className="underline underline-offset-2 hover:text-gold-light">Información legal</Link>
          {" · "}
          <a href="https://www.sic.gov.co" target="_blank" rel="noreferrer" className="underline underline-offset-2 hover:text-gold-light">
            Superintendencia de Industria y Comercio
          </a>
        </p>
      </div>
    </footer>
  );
}
