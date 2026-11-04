"use client";

import { useState } from "react";

/** Convierte un enlace de YouTube o Vimeo en su reproductor embebido (sin cookies cuando es posible). */
function embedUrl(url: string): string | null {
  try {
    const u = new URL(url);
    const host = u.hostname.replace(/^www\./, "");
    if (host === "youtu.be") return `https://www.youtube-nocookie.com/embed/${u.pathname.slice(1)}?autoplay=1&rel=0`;
    if (host.endsWith("youtube.com")) {
      const id = u.searchParams.get("v") ?? u.pathname.split("/").filter(Boolean).pop();
      return id ? `https://www.youtube-nocookie.com/embed/${id}?autoplay=1&rel=0` : null;
    }
    if (host.endsWith("vimeo.com")) {
      const id = u.pathname.split("/").filter(Boolean).pop();
      return id ? `https://player.vimeo.com/video/${id}?autoplay=1&dnt=1` : null;
    }
  } catch {}
  return null;
}

/**
 * Video del producto: no descarga NADA hasta que el cliente pulsa reproducir
 * (no frena la compra ni gasta datos en celular).
 */
export function ProductVideo({ url, name }: { url: string; name: string }) {
  const [on, setOn] = useState(false);
  const embed = embedUrl(url);
  return (
    <div className="aura-bg grain relative isolate aspect-video overflow-hidden rounded-[28px] shadow-lift">
      {on ? (
        embed ? (
          <iframe src={embed} title={`Video de ${name}`} allow="autoplay; encrypted-media; picture-in-picture" allowFullScreen className="absolute inset-0 size-full" />
        ) : (
          <video src={url} controls autoPlay playsInline preload="none" className="absolute inset-0 size-full object-contain">
            Tu navegador no puede reproducir este video.
          </video>
        )
      ) : (
        <button type="button" onClick={() => setOn(true)} className="group absolute inset-0 grid place-items-center text-ivory" aria-label={`Reproducir video de ${name}`}>
          <span className="flex flex-col items-center gap-4">
            <span className="glass-dark grid size-20 place-items-center rounded-full transition-transform duration-300 group-hover:scale-110">
              <svg viewBox="0 0 24 24" width="28" height="28" fill="currentColor" aria-hidden="true" className="ml-1 text-gold-light"><path d="M8 5.5v13l11-6.5z" /></svg>
            </span>
            <span className="text-xs font-semibold uppercase tracking-[.3em] text-ivory/75">Ver en video</span>
          </span>
        </button>
      )}
    </div>
  );
}
