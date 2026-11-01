"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

const reduced = () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/**
 * Revela su contenido al entrar en pantalla (título, tarjetas, fotos). Sin JS o con movimiento reducido
 * el contenido se ve igual: la clase solo agrega la transición.
 */
export function Reveal({ children, className = "", delay = 0, as: Tag = "div" }: { children: ReactNode; className?: string; delay?: number; as?: "div" | "section" | "li" }) {
  const ref = useRef<HTMLElement>(null);
  const [shown, setShown] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || reduced() || !("IntersectionObserver" in window)) return setShown(true);
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setShown(true); io.disconnect(); } }, { rootMargin: "0px 0px -8% 0px", threshold: 0.12 });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return (
    <Tag ref={ref as never} style={{ transitionDelay: `${delay}ms` }} className={`reveal ${shown ? "is-visible" : ""} ${className}`}>
      {children}
    </Tag>
  );
}

/** Parallax suave para la foto del hero: solo en pantallas grandes y sin movimiento reducido (ahorra batería en celular). */
export function Parallax({ children, strength = 0.18, className = "" }: { children: ReactNode; strength?: number; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el || reduced() || !window.matchMedia("(min-width: 1024px)").matches) return;
    let frame = 0;
    const onScroll = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const y = Math.min(window.scrollY, window.innerHeight);
        el.style.transform = `translate3d(0, ${y * strength}px, 0)`;
      });
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => { window.removeEventListener("scroll", onScroll); cancelAnimationFrame(frame); };
  }, [strength]);
  return <div ref={ref} className={`will-change-transform ${className}`}>{children}</div>;
}

/** Carrusel horizontal con desplazamiento por toque/rueda y flechas en computador. */
export function Rail({ children, label }: { children: ReactNode; label: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const move = (dir: 1 | -1) => ref.current?.scrollBy({ left: dir * ref.current.clientWidth * 0.85, behavior: reduced() ? "auto" : "smooth" });
  return (
    <div className="relative">
      <div ref={ref} role="region" aria-label={label} tabIndex={0} className="no-scrollbar -mx-5 flex snap-x snap-mandatory gap-4 overflow-x-auto scroll-px-5 px-5 pb-2 outline-none lg:-mx-8 lg:gap-6 lg:scroll-px-8 lg:px-8">
        {children}
      </div>
      <div className="pointer-events-none absolute -top-16 right-0 hidden gap-2 sm:flex">
        {([-1, 1] as const).map((d) => (
          <button key={d} type="button" onClick={() => move(d)} aria-label={d < 0 ? "Anteriores" : "Siguientes"} className="pointer-events-auto grid size-11 place-items-center rounded-full border border-ink/15 bg-white/70 text-lg backdrop-blur transition-all hover:border-gold hover:bg-gold active:scale-95">
            {d < 0 ? "←" : "→"}
          </button>
        ))}
      </div>
    </div>
  );
}

/**
 * Inclinación 3D al mover el cursor, con un brillo dorado que sigue al puntero.
 * Solo con mouse (no en pantallas táctiles) y sin movimiento reducido.
 */
export function Tilt({ children, className = "", max = 7 }: { children: ReactNode; className?: string; max?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const enabled = useRef(false);
  useEffect(() => {
    enabled.current = !reduced() && window.matchMedia("(hover: hover) and (pointer: fine)").matches;
  }, []);
  const onMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const el = ref.current;
    if (!el || !enabled.current) return;
    const r = el.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width;
    const y = (e.clientY - r.top) / r.height;
    el.style.transform = `perspective(900px) rotateX(${(0.5 - y) * max}deg) rotateY(${(x - 0.5) * max}deg) translateZ(0)`;
    el.style.setProperty("--shine-x", `${x * 100}%`);
    el.style.setProperty("--shine-y", `${y * 100}%`);
  };
  const reset = () => { if (ref.current) ref.current.style.transform = ""; };
  return (
    <div ref={ref} onPointerMove={onMove} onPointerLeave={reset} className={`tilt ${className}`}>
      {children}
    </div>
  );
}
