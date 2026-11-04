import { PageHero } from "@/components/aura/PageHero";
import { Button } from "@/components/ui/Button";

export default function NotFound() {
  return (
    <main id="contenido">
      <PageHero eyebrow="Error 404" title="Esta página" accent="no existe." lead="Puede que el enlace haya cambiado o que el producto ya no esté publicado.">
        <div className="flex flex-wrap gap-3">
          <Button href="/catalogo" variant="gold">Ver catálogo</Button>
          <Button href="/" variant="secondary" className="border-ivory/30 text-ivory hover:border-gold hover:bg-white/5">Ir al inicio</Button>
        </div>
      </PageHero>
    </main>
  );
}
