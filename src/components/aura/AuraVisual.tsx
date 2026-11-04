"use client";

import dynamic from "next/dynamic";
import { AuraFallback } from "./AuraOrb";

/** Carga diferida del Aura 3D: mientras llega (o sin JS) se ve la versión estática, sin saltos de diseño. */
const AuraOrb = dynamic(() => import("./AuraOrb"), { ssr: false, loading: () => <AuraFallback className="size-full" /> });

export function AuraVisual({ className = "relative" }: { className?: string }) {
  // Quien lo usa define el posicionamiento (relative o absolute) en className.
  return (
    <div className={className}>
      {/* Halo dorado detrás de la esfera */}
      <div aria-hidden="true" className="absolute inset-[12%] rounded-full bg-gold/25 blur-3xl" />
      <AuraOrb className="relative size-full" />
      {/* Reflejo en el "piso" */}
      <div aria-hidden="true" className="absolute -bottom-[2%] left-1/2 h-[8%] w-[46%] -translate-x-1/2 rounded-[50%] bg-gold/30 blur-2xl" />
    </div>
  );
}

/** Partículas doradas discretas (CSS puro, se detienen con "reducir movimiento"). */
export function AuraParticles({ count = 18 }: { count?: number }) {
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
      {Array.from({ length: count }, (_, i) => {
        const left = (i * 53) % 100;
        const delay = (i * 0.7) % 9;
        const size = 2 + (i % 3);
        const dur = 9 + (i % 5) * 2;
        return (
          <span
            key={i}
            className="aura-particle absolute rounded-full bg-gold-light"
            style={{ left: `${left}%`, bottom: "-4%", width: size, height: size, animationDelay: `${delay}s`, animationDuration: `${dur}s`, opacity: 0.35 + (i % 4) * 0.12 }}
          />
        );
      })}
    </div>
  );
}
