export default function ContactoPage() {
  return (
    <main id="contenido" className="min-h-[60vh] bg-ivory px-6 py-16 md:px-10 md:py-20">
      <div className="mx-auto max-w-4xl">
        <h1 className="font-display text-5xl leading-tight">
          Contacto
        </h1>

        <p className="mt-6 max-w-3xl text-base leading-7 text-ink-soft">
          Estamos disponibles para ayudarte con disponibilidad,
          pedidos y soporte de 7H STORE.
        </p>

        <div className="mt-12 max-w-xl">
          <a
            href="https://www.instagram.com/store.h7_/"
            target="_blank"
            rel="noreferrer"
            className="group block border border-ink/20 p-6 transition-colors hover:border-gold"
          >
            <p className="text-xs font-semibold uppercase tracking-[0.15em] text-gold">
              Instagram
            </p>

            <h2 className="mt-3 font-display text-2xl">
              @store.h7_
            </h2>

            <p className="mt-3 text-sm text-ink-soft">
              Síguenos y conoce nuestras novedades y productos.
            </p>
          </a>
        </div>
      </div>
    </main>
  );
}