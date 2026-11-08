"use client";

import dynamic from "next/dynamic";
import type { RefObject } from "react";

// La MISMA esfera del inicio (WebGL2 propio, sin librerías). Se carga aparte y después de que la página
// termina de cargar; mientras tanto (o sin WebGL2) se ve la versión CSS.
/** Versión CSS en tamaño pequeño: obsidiana con brillo dorado (la de la esfera grande se pierde a 40 px). */
const SmallFallback = () => (
  <span className="absolute inset-[14%] rounded-full bg-[radial-gradient(circle_at_34%_30%,#f1dfae_0%,#d8b866_14%,#7d5f1a_42%,#14110b_70%,#0a0a0a_100%)] shadow-[0_0_18px_-2px_rgb(201_164_76_/_.6)] ring-1 ring-gold/50" />
);
const HeroOrb3D = dynamic(() => import("./HeroOrb3D"), { ssr: false, loading: SmallFallback });

export type AuraMood = "idle" | "welcome" | "listening" | "thinking" | "responding" | "error";

/** Energía del shader por estado (1 = la esfera del inicio tal cual). */
export const MOOD_ENERGY: Record<AuraMood, number> = { idle: 0.85, welcome: 2.2, listening: 1.25, thinking: 2, responding: 1.45, error: 0.35 };

export function AuraOrb({ energy, className = "", fps = 24 }: { energy: RefObject<number>; className?: string; fps?: number }) {
  return (
    <span aria-hidden="true" className={`relative block ${className}`}>
      {/* Debajo siempre la versión CSS: se ve mientras la esfera WebGL espera a que la página termine de cargar. */}
      <SmallFallback />
      <HeroOrb3D className="absolute inset-[-14%]" energy={energy} maxFps={fps} interactive={false} fallback={<SmallFallback />} />
    </span>
  );
}
