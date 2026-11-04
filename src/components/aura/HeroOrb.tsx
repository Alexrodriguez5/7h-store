"use client";

import dynamic from "next/dynamic";

/** La esfera 3D se carga aparte y solo en el navegador. */
const HeroOrb3D = dynamic(() => import("./HeroOrb3D"), { ssr: false, loading: () => null });

/**
 * El contenedor (con su tamaño y proporción) se pinta desde el servidor: el espacio queda reservado
 * antes de que llegue el código 3D, así la página no salta (CLS 0). La esfera aparece desde la oscuridad.
 */
export function HeroOrb({ className = "" }: { className?: string }) {
  return (
    <div className={className}>
      <HeroOrb3D className="size-full" />
    </div>
  );
}
