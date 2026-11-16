import { Button } from "@/components/ui/Button";

/** 404 real (no un 200 con el texto «no encontrado») para códigos de pedido que no existen. */
export default function OrderNotFound() {
  return (
    <main id="contenido" className="mx-auto max-w-xl px-5 py-24 text-center">
      <h1 className="font-display text-4xl">Pedido no encontrado.</h1>
      <p className="mt-4 text-ink/70">Revisa el código del pedido o entra a tu cuenta para ver tus pedidos.</p>
      <div className="mt-6 flex flex-wrap justify-center gap-3">
        <Button href="/cuenta/pedidos">Ver mis pedidos</Button>
        <Button href="/catalogo" variant="secondary">Volver al catálogo</Button>
      </div>
    </main>
  );
}
