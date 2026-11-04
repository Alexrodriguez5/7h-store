/**
 * Monograma 7H (SVG propio, nítido a cualquier tamaño y densidad de pantalla).
 * Geometría: el trazo del 7 baja en diagonal con el mismo grosor y la misma separación que los astiles
 * de la H; la barra superior del 7 y el travesaño de la H comparten proporción (1 : 0,52).
 * Sin sombras, degradados ni deformaciones.
 */
export function Monogram({ className = "", title }: { className?: string; title?: string }) {
  return (
    <svg viewBox="0 0 40 40" className={className} role={title ? "img" : undefined} aria-hidden={title ? undefined : true} aria-label={title} fill="none" stroke="currentColor" strokeWidth="3.4" strokeLinecap="square" strokeLinejoin="miter">
      <path d="M3.5 7.5H17.5L10 33" />
      <path d="M22.5 7.5V33M35.5 7.5V33M22.5 20.25H35.5" />
    </svg>
  );
}

/** Logo completo: monograma + STORE con tracking amplio. `tone` controla el color del texto. */
export function Logo({ tone = "light", size = "md" }: { tone?: "light" | "dark"; size?: "md" | "lg" }) {
  const lg = size === "lg";
  return (
    <span className="inline-flex items-center gap-2.5">
      <Monogram className={`${lg ? "size-12" : "size-8"} text-gold-light`} />
      <span className={`font-sans font-semibold ${lg ? "text-[15px] tracking-[.5em]" : "text-[11px] tracking-[.46em]"} ${tone === "light" ? "text-ivory" : "text-ink"}`}>STORE</span>
    </span>
  );
}
