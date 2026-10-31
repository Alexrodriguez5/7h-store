/**
 * Ilustración isométrica (SVG puro, sin dependencias): paquete 7H STORE sobre una plataforma,
 * ruta de entrega punteada, pin de destino y cubos flotantes. Decorativa (aria-hidden).
 * Las animaciones usan clases de globals.css y se desactivan con prefers-reduced-motion.
 */
export function IsoPackage({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 420 380" className={className} aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id="iso-gold" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#D8B866" />
          <stop offset="1" stopColor="#C9A44C" />
        </linearGradient>
        <linearGradient id="iso-box-top" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#3a3a3a" />
          <stop offset="1" stopColor="#262626" />
        </linearGradient>
        <radialGradient id="iso-glow" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="#C9A44C" stopOpacity=".35" />
          <stop offset="1" stopColor="#C9A44C" stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* Resplandor y rejilla isométrica de fondo */}
      <ellipse cx="210" cy="250" rx="190" ry="110" fill="url(#iso-glow)" />
      <g stroke="#C9A44C" strokeOpacity=".14" strokeWidth="1">
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <path key={`a${i}`} d={`M${40 + i * 34} ${270 + i * 0} l170 -98`} transform={`translate(0 ${i * 19.6})`} />
        ))}
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <path key={`b${i}`} d={`M${210 + i * 34} ${172 + i * 19.6} l-170 98`} />
        ))}
      </g>

      {/* Plataforma */}
      <g>
        <path d="M210 196 L330 265 L210 334 L90 265 Z" fill="#141414" />
        <path d="M90 265 L210 334 L210 350 L90 281 Z" fill="#0A0A0A" />
        <path d="M330 265 L210 334 L210 350 L330 281 Z" fill="#1d1d1d" />
        <path d="M210 196 L330 265 L210 334 L90 265 Z" fill="none" stroke="#C9A44C" strokeOpacity=".5" />
      </g>

      {/* Ruta punteada hacia el destino */}
      <path className="iso-dash" d="M210 290 C 260 300, 300 290, 318 262" fill="none" stroke="url(#iso-gold)" strokeWidth="2.5" strokeDasharray="6 7" strokeLinecap="round" />

      {/* Paquete principal (flota suavemente) */}
      <g className="iso-float">
        <ellipse cx="200" cy="292" rx="62" ry="18" fill="#000" opacity=".35" />
        {/* caras */}
        <path d="M200 150 L270 190 L200 230 L130 190 Z" fill="url(#iso-box-top)" />
        <path d="M130 190 L200 230 L200 300 L130 260 Z" fill="#1b1b1b" />
        <path d="M270 190 L200 230 L200 300 L270 260 Z" fill="#111" />
        {/* cinta dorada */}
        <path d="M165 170 L235 210 L235 214 L165 174 Z" fill="url(#iso-gold)" />
        <path d="M235 210 L235 280 L230 283 L230 213 Z" fill="#C9A44C" opacity=".9" />
        <path d="M235 170 L165 210 L165 214 L235 174 Z" fill="url(#iso-gold)" opacity=".75" />
        <path d="M165 210 L165 280 L170 283 L170 213 Z" fill="#D8B866" opacity=".8" />
        {/* etiqueta 7H en la cara izquierda */}
        <g transform="matrix(1 .571 0 1 140 205)">
          <rect x="4" y="4" width="34" height="22" rx="3" fill="#F5F1E8" />
          <text x="21" y="20" textAnchor="middle" fontFamily="Georgia, serif" fontSize="13" fontWeight="700" fill="#0A0A0A">7H</text>
        </g>
        {/* aristas */}
        <path d="M200 150 L270 190 L270 260 L200 300 L130 260 L130 190 Z M200 230 L200 300 M130 190 L200 230 L270 190" fill="none" stroke="#C9A44C" strokeOpacity=".35" />
      </g>

      {/* Pin de destino */}
      <g className="iso-float-slow">
        <path d="M318 214 a16 16 0 0 1 16 16 c0 13 -16 30 -16 30 s-16 -17 -16 -30 a16 16 0 0 1 16 -16 Z" fill="url(#iso-gold)" />
        <circle cx="318" cy="230" r="6" fill="#0A0A0A" />
      </g>

      {/* Cubos flotantes */}
      <g className="iso-float-slow" opacity=".95">
        <path d="M78 96 L100 109 L78 122 L56 109 Z" fill="#D8B866" />
        <path d="M56 109 L78 122 L78 146 L56 133 Z" fill="#C9A44C" />
        <path d="M100 109 L78 122 L78 146 L100 133 Z" fill="#a9893d" />
      </g>
      <g className="iso-float" opacity=".9">
        <path d="M344 70 L358 78 L344 86 L330 78 Z" fill="#2a2a2a" stroke="#C9A44C" strokeOpacity=".6" />
        <path d="M330 78 L344 86 L344 101 L330 93 Z" fill="#1a1a1a" stroke="#C9A44C" strokeOpacity=".6" />
        <path d="M358 78 L344 86 L344 101 L358 93 Z" fill="#0f0f0f" stroke="#C9A44C" strokeOpacity=".6" />
      </g>
      <g className="iso-float-slow" opacity=".7">
        <path d="M120 40 L130 46 L120 52 L110 46 Z" fill="none" stroke="#D8B866" />
        <path d="M110 46 L120 52 L120 63 L110 57 Z M130 46 L120 52 L120 63 L130 57 Z" fill="none" stroke="#D8B866" />
      </g>
      <circle cx="290" cy="120" r="3" fill="#D8B866" className="iso-float" />
      <circle cx="60" cy="210" r="2.5" fill="#D8B866" opacity=".7" className="iso-float-slow" />
    </svg>
  );
}
