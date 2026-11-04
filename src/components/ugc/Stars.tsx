"use client";

import { useState } from "react";

const PATH = "M12 2.8l2.84 5.76 6.36.92-4.6 4.48 1.08 6.33L12 17.3l-5.68 2.99 1.08-6.33-4.6-4.48 6.36-.92z";

/** Estrellas de solo lectura (admite medias por ancho). */
export function Stars({ value, size = 16, className = "" }: { value: number; size?: number; className?: string }) {
  return (
    <span className={`relative inline-flex ${className}`} role="img" aria-label={`${value.toFixed(1).replace(".0", "")} de 5 estrellas`}>
      <span className="flex text-ink/15">{[0, 1, 2, 3, 4].map((i) => <svg key={i} viewBox="0 0 24 24" width={size} height={size} fill="currentColor" aria-hidden="true"><path d={PATH} /></svg>)}</span>
      <span className="absolute inset-0 flex overflow-hidden text-gold" style={{ width: `${(Math.max(0, Math.min(5, value)) / 5) * 100}%` }}>
        {[0, 1, 2, 3, 4].map((i) => <svg key={i} viewBox="0 0 24 24" width={size} height={size} fill="currentColor" aria-hidden="true" className="shrink-0"><path d={PATH} /></svg>)}
      </span>
    </span>
  );
}

const WORDS = ["", "Muy malo", "Malo", "Regular", "Bueno", "Excelente"];

/** Selector de 1 a 5 estrellas, accesible con teclado (grupo de radios). */
export function StarInput({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const [hover, setHover] = useState(0);
  const shown = hover || value;
  return (
    <div className="flex items-center gap-3">
      <div role="radiogroup" aria-label="Calificación" className="flex" onMouseLeave={() => setHover(0)}>
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            role="radio"
            aria-checked={value === n}
            aria-label={`${n} ${n === 1 ? "estrella" : "estrellas"}`}
            onMouseEnter={() => setHover(n)}
            onClick={() => onChange(n)}
            className={`p-0.5 transition-transform duration-150 hover:scale-110 ${n <= shown ? "text-gold" : "text-ink/20"} ${value === n ? "otp-pop" : ""}`}
          >
            <svg viewBox="0 0 24 24" width={30} height={30} fill="currentColor" aria-hidden="true"><path d={PATH} /></svg>
          </button>
        ))}
      </div>
      <span className="text-sm font-medium text-ink-soft" aria-live="polite">{WORDS[shown]}</span>
    </div>
  );
}
