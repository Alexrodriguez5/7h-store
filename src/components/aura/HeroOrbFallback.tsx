/** Versión CSS de la esfera (vectorial, nítida): se ve al cargar, sin WebGL2 o si se pierde el contexto. */
export function HeroOrbFallback({ className = "" }: { className?: string }) {
  return (
    <div aria-hidden="true" className={`relative ${className}`}>
      <div className="absolute inset-[11%] rounded-full bg-[radial-gradient(circle_at_50%_50%,#050505_0%,#0b0a08_58%,#2a2213_80%,#c9a44c_96%,transparent_100%)] shadow-[0_0_80px_-10px_rgb(201_164_76_/_.45)]" />
      <div className="absolute inset-[11%] rounded-full bg-[radial-gradient(circle_at_32%_28%,rgb(255_244_220_/_.18),transparent_22%)]" />
    </div>
  );
}
