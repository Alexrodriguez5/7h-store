"use client";

import Image from "next/image";
import { useState } from "react";
import { Tilt } from "@/components/home/Motion";

/**
 * Galería del producto (7H AURA): imagen grande con profundidad sutil (inclinación y brillo al pasar
 * el cursor), transición suave al cambiar de foto y miniaturas de vidrio. Con una sola foto no muestra miniaturas.
 */
export function ProductGallery({ images, name }: { images: string[]; name: string }) {
  const [active, setActive] = useState(0);
  const many = images.length > 1;
  return (
    <div className={`grid gap-3 ${many ? "sm:grid-cols-[84px_1fr]" : ""}`}>
      {many && (
        <div className="no-scrollbar order-2 flex gap-2 overflow-auto sm:order-1 sm:flex-col">
          {images.map((src, i) => (
            <button
              type="button"
              aria-pressed={active === i}
              key={src}
              onClick={() => setActive(i)}
              aria-label={`Ver imagen ${i + 1} de ${images.length}`}
              className={`relative h-20 w-16 shrink-0 overflow-hidden rounded-2xl border transition-all duration-300 sm:h-24 sm:w-full ${active === i ? "border-gold shadow-[0_0_0_3px_rgb(201_164_76_/_.25)]" : "border-ink/10 opacity-65 hover:opacity-100"}`}
            >
              <Image src={src} alt="" fill sizes="84px" className="object-cover" />
            </button>
          ))}
        </div>
      )}
      <Tilt className="order-1 rounded-[32px] sm:order-2" max={4}>
        <div className="relative aspect-[4/5] overflow-hidden rounded-[32px] bg-gradient-to-b from-white to-ivory-200 shadow-lift ring-1 ring-ink/[.06]">
          {images[active] && (
            <Image key={images[active]} src={images[active]} alt={name} fill priority={active === 0} sizes="(min-width:1024px) 46vw, 100vw" className="animate-[fade-up_.45s_cubic-bezier(.22,1,.36,1)_both] object-cover" />
          )}
          {many && (
            <span className="glass absolute bottom-4 right-4 rounded-full px-3 py-1 text-[11px] font-semibold tabular-nums text-ink">{active + 1} / {images.length}</span>
          )}
        </div>
      </Tilt>
    </div>
  );
}
