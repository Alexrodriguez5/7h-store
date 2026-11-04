"use client";

import { useEffect, useRef, useState } from "react";
import { HeroOrbFallback } from "./HeroOrbFallback";

/**
 * Esfera 7H: obsidiana con filamentos de oro líquido (WebGL2 + GLSL, sin librerías).
 *
 * Por qué es nítida y liviana:
 * - La esfera se calcula ANALÍTICAMENTE por píxel (intersección rayo-esfera), sin texturas ni mallas:
 *   el borde es matemáticamente exacto y se suaviza con fwidth (antialias real a cualquier densidad).
 * - El canvas se dibuja a la resolución REAL de la pantalla (devicePixelRatio hasta 2). La versión
 *   anterior dibujaba a ~0,9 px por píxel CSS en celular y el navegador la estiraba: de ahí el pixelado.
 * - Calidad adaptativa: si el equipo no sostiene ~50 FPS, baja primero el detalle del ruido y después
 *   la resolución en pasos pequeños (nunca por debajo de 1 px de canvas por píxel CSS).
 * - Se pausa fuera de pantalla y con la pestaña oculta; con "reducir movimiento" dibuja un solo cuadro.
 * - Si no hay WebGL2 (o se pierde el contexto) se muestra la versión CSS, también vectorial.
 */

const VERT = `#version 300 es
in vec2 aPos;
out vec2 vUv;
void main() { vUv = aPos; gl_Position = vec4(aPos, 0.0, 1.0); }`;

const FRAG = `#version 300 es
precision highp float;
in vec2 vUv;
out vec4 outColor;
uniform float uTime;
uniform float uReveal;
uniform float uDetail;   // 1.0 = alto, 0.0 = reducido
uniform vec2 uTilt;      // inclinación por el cursor (-1..1)
uniform float uAspect;

// ── Ruido de valor 3D (barato y suave) ──
float hash(vec3 p) { p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
float noise(vec3 x) {
  vec3 i = floor(x); vec3 f = fract(x); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(hash(i), hash(i + vec3(1,0,0)), f.x), mix(hash(i + vec3(0,1,0)), hash(i + vec3(1,1,0)), f.x), f.y),
             mix(mix(hash(i + vec3(0,0,1)), hash(i + vec3(1,0,1)), f.x), mix(hash(i + vec3(0,1,1)), hash(i + vec3(1,1,1)), f.x), f.y), f.z);
}
float fbm(vec3 p, int oct) {
  float v = 0.0, a = 0.5;
  for (int i = 0; i < 5; i++) { if (i >= oct) break; v += a * noise(p); p = p * 2.03 + 17.1; a *= 0.5; }
  return v;
}
mat3 rotY(float a) { float c = cos(a), s = sin(a); return mat3(c, 0, -s, 0, 1, 0, s, 0, c); }
mat3 rotX(float a) { float c = cos(a), s = sin(a); return mat3(1, 0, 0, 0, c, s, 0, -s, c); }

// Filamentos: vetas finas donde el ruido deformado (domain warping) cruza un valor, como oro líquido.
// Devuelve (núcleo brillante, resplandor alrededor).
vec2 filaments(vec3 p, float t, int oct) {
  vec3 q = p * 1.8;
  vec3 w = vec3(fbm(q + vec3(0.0, t * 0.06, 0.0), oct), fbm(q + vec3(5.2, 1.3, t * 0.05), oct), fbm(q + vec3(2.1, t * 0.055, 7.7), oct));
  float n = fbm(q + 3.2 * w, oct);
  float line = abs(n - 0.5);
  // Solo algunas zonas tienen vetas: el resto queda como obsidiana limpia.
  float mask = smoothstep(0.26, 0.52, fbm(p * 1.4 + vec3(t * 0.015), 3));
  return vec2(smoothstep(0.022, 0.0, line), smoothstep(0.08, 0.0, line)) * mask;
}

void main() {
  vec2 uv = vUv * vec2(uAspect, 1.0);
  float R = 0.78;
  float d = length(uv);
  float aa = fwidth(d) * 1.25;

  vec3 gold = vec3(0.847, 0.722, 0.400);
  vec3 deep = vec3(0.788, 0.643, 0.298);

  // Halo exterior muy sutil (no se anima, no usa blur).
  float halo = exp(-max(d - R, 0.0) * 9.0) * 0.20 * uReveal;
  if (d > R + aa) { outColor = halo < 0.004 ? vec4(0.0) : vec4(deep * halo, halo); return; }

  // Intersección rayo-esfera (cámara frontal): z exacta en cada píxel.
  vec2 s = uv / R;
  float z = sqrt(max(1.0 - dot(s, s), 0.0));
  vec3 n = normalize(vec3(s, z));

  float t = uTime;
  mat3 rot = rotY(t * 0.07 + uTilt.x * 0.25) * rotX(0.35 + uTilt.y * 0.18);
  vec3 p = rot * n;

  int oct = uDetail > 0.5 ? 5 : 3;
  // Capa exterior de filamentos y una capa interior más tenue (da profundidad de vidrio).
  vec2 f1 = filaments(p, t, oct);
  vec2 f2 = filaments(rot * normalize(n * vec3(1.0, 1.0, 0.55)) * 0.82 + 3.0, t * 0.8, oct > 3 ? 4 : 3);

  float fres = pow(1.0 - z, 3.0);
  vec3 L = normalize(vec3(-0.45, 0.55, 0.7));
  float spec = pow(max(dot(reflect(-L, n), vec3(0, 0, 1)), 0.0), 140.0);
  float relief = fbm(p * 7.0, oct > 3 ? 3 : 2);

  // Obsidiana: casi negra, con un leve relieve y reflejo frío/cálido.
  vec3 col = vec3(0.020, 0.018, 0.016) + vec3(0.06, 0.05, 0.04) * relief * relief;
  col += vec3(0.95, 0.88, 0.75) * spec * 0.14;
  // Oro: filamentos con más brillo hacia el borde (luz que viaja por dentro del vidrio).
  float glow = 0.6 + 1.1 * fres;
  vec3 hot = vec3(1.0, 0.93, 0.74);
  col += mix(gold, hot, f1.x) * f1.x * glow * 1.35 * uReveal;
  col += deep * f1.y * 0.22 * glow * uReveal;
  // Capa interior: vetas tenues que se ven "a través" del vidrio.
  col += deep * (f2.x * 0.22 + f2.y * 0.05) * (0.35 + fres) * uReveal;
  // Borde dorado (fresnel) y contorno fino.
  col += deep * pow(1.0 - z, 2.6) * 0.5 * uReveal;
  col += gold * smoothstep(0.95, 1.0, length(s)) * 0.25 * uReveal;

  // Aparición desde la oscuridad.
  col *= mix(0.15, 1.0, uReveal);
  float alpha = 1.0 - smoothstep(R - aa, R + aa, d);
  col = col * alpha + deep * halo * (1.0 - alpha);
  outColor = vec4(col, max(alpha, halo));
}`;

function shader(gl: WebGL2RenderingContext, type: number, src: string) {
  const s = gl.createShader(type)!;
  gl.shaderSource(s, src);
  gl.compileShader(s);
  return s;
}

type IdleWindow = Window & { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number; cancelIdleCallback?: (id: number) => void };

export default function HeroOrb3D({ className = "" }: { className?: string }) {
  const wrap = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const el = canvas.current;
    const box = wrap.current;
    if (!el || !box) return;
    let disposed = false;
    const cleanups: (() => void)[] = [];
    const w = window as IdleWindow;

    // 1) Esperar a que la página termine de cargar y el navegador quede libre: la esfera nunca compite
    //    con el texto, las fotos ni la interacción inicial.
    const whenIdle = (fn: () => void) => {
      const go = () => {
        if (w.requestIdleCallback) { const id = w.requestIdleCallback(fn, { timeout: 1500 }); cleanups.push(() => w.cancelIdleCallback?.(id)); }
        else { const id = window.setTimeout(fn, 400); cleanups.push(() => clearTimeout(id)); }
      };
      if (document.readyState === "complete") go();
      else { window.addEventListener("load", go, { once: true }); cleanups.push(() => window.removeEventListener("load", go)); }
    };

    whenIdle(() => {
      if (disposed) return;
      const gl = el.getContext("webgl2", { alpha: true, antialias: false, premultipliedAlpha: true, powerPreference: "high-performance" });
      if (!gl) return setFailed(true);
      // Sin GPU real (render por software) el shader correría en el procesador y frenaría la página.
      const dbg = gl.getExtension("WEBGL_debug_renderer_info");
      const renderer = dbg ? String(gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL)) : "";
      if (/swiftshader|llvmpipe|software|basic render/i.test(renderer)) return setFailed(true);

      // 2) Compilación en paralelo (KHR_parallel_shader_compile): no bloquea el hilo principal.
      const parallel = gl.getExtension("KHR_parallel_shader_compile") as { COMPLETION_STATUS_KHR: number } | null;
      const prog = gl.createProgram()!;
      gl.attachShader(prog, shader(gl, gl.VERTEX_SHADER, VERT));
      gl.attachShader(prog, shader(gl, gl.FRAGMENT_SHADER, FRAG));
      gl.linkProgram(prog);
      const waitLink = () => {
        if (disposed) return;
        if (parallel && !gl.getProgramParameter(prog, parallel.COMPLETION_STATUS_KHR)) {
          const id = window.setTimeout(waitLink, 50);
          cleanups.push(() => clearTimeout(id));
          return;
        }
        if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return setFailed(true);
        start(gl, prog);
      };
      waitLink();
    });

    // 3) Escena y bucle de animación.
    const start = (gl: WebGL2RenderingContext, prog: WebGLProgram) => {
      gl.useProgram(prog);
      const buf = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, buf);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
      const loc = gl.getAttribLocation(prog, "aPos");
      gl.enableVertexAttribArray(loc);
      gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
      const u = (n: string) => gl.getUniformLocation(prog, n);
      const uTime = u("uTime"), uReveal = u("uReveal"), uDetail = u("uDetail"), uTilt = u("uTilt"), uAspect = u("uAspect");

      const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      const fine = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
      // En celulares y tabletas basta con 30 cuadros por segundo (movimiento lento): la mitad de trabajo de GPU.
      const minFrame = fine ? 0 : 1000 / 31;
      // Resolución real de la pantalla (máx. 2). Baja en pasos si el equipo no sostiene la animación.
      const maxScale = Math.min(window.devicePixelRatio || 1, 2);
      const steps = [maxScale, Math.max(1, maxScale * 0.85), Math.max(1, maxScale * 0.72), 1].filter((v, i, a) => a.indexOf(v) === i);
      let level = 0;
      let detail = 1;

      const resize = () => {
        const r = box.getBoundingClientRect();
        const sc = steps[level];
        const cw = Math.max(1, Math.round(r.width * sc));
        const ch = Math.max(1, Math.round(r.height * sc));
        if (el.width !== cw || el.height !== ch) { el.width = cw; el.height = ch; }
        gl.viewport(0, 0, cw, ch);
        gl.uniform1f(uAspect, cw / ch);
      };
      const ro = new ResizeObserver(resize);
      ro.observe(box);
      resize();

      let tilt = [0, 0];
      let target = [0, 0];
      const onMove = (e: PointerEvent) => { target = [(e.clientX / window.innerWidth) * 2 - 1, (e.clientY / window.innerHeight) * 2 - 1]; };
      if (fine && !reduced) window.addEventListener("pointermove", onMove, { passive: true });

      let raf = 0;
      let visible = true;
      const t0 = performance.now();
      let last = t0;
      let slow = 0;
      let frames = 0;

      const draw = (now: number) => {
        const t = (now - t0) / 1000;
        const reveal = reduced ? 1 : Math.min(1, t / 2.4);
        const eased = 1 - Math.pow(1 - reveal, 3);
        tilt = [tilt[0] + (target[0] - tilt[0]) * 0.04, tilt[1] + (target[1] - tilt[1]) * 0.04];
        gl.clearColor(0, 0, 0, 0);
        gl.clear(gl.COLOR_BUFFER_BIT);
        gl.uniform1f(uTime, reduced ? 6 : t + 6);
        gl.uniform1f(uReveal, eased);
        gl.uniform1f(uDetail, detail);
        gl.uniform2f(uTilt, tilt[0], -tilt[1]);
        gl.drawArrays(gl.TRIANGLES, 0, 3);
      };

      const loop = (now: number) => {
        raf = visible && !document.hidden ? requestAnimationFrame(loop) : 0;
        const dt = now - last;
        if (dt < minFrame) return;
        last = now;
        draw(now);
        // Calidad adaptativa: si muchos cuadros tardan más de lo esperado, baja detalle y luego resolución.
        if (now - t0 > 2600) {
          frames++;
          if (dt > Math.max(20, minFrame * 1.6)) slow++;
          if (frames >= 45) {
            if (slow > 18) {
              if (detail === 1) detail = 0;
              else if (level < steps.length - 1) { level++; resize(); }
            }
            frames = 0;
            slow = 0;
          }
        }
      };

      const play = () => { cancelAnimationFrame(raf); last = performance.now(); raf = requestAnimationFrame(loop); };
      const io = new IntersectionObserver(([e]) => { visible = e.isIntersecting; if (visible && !reduced) play(); }, { threshold: 0.01 });
      io.observe(box);
      const onVis = () => { if (!document.hidden && visible && !reduced) play(); };
      document.addEventListener("visibilitychange", onVis);
      const onLost = (e: Event) => { e.preventDefault(); cancelAnimationFrame(raf); setFailed(true); };
      el.addEventListener("webglcontextlost", onLost);

      if (reduced) draw(performance.now());
      else play();
      setReady(true);

      cleanups.push(() => {
        cancelAnimationFrame(raf);
        ro.disconnect();
        io.disconnect();
        document.removeEventListener("visibilitychange", onVis);
        window.removeEventListener("pointermove", onMove);
        el.removeEventListener("webglcontextlost", onLost);
        gl.deleteBuffer(buf);
        gl.deleteProgram(prog);
      });
    };

    return () => {
      disposed = true;
      cleanups.forEach((fn) => fn());
    };
  }, []);

  return (
    <div ref={wrap} className={`relative ${className}`}>
      {/* La aparición la hace el propio shader (desde la oscuridad); la versión CSS solo si WebGL2 no está disponible. */}
      {failed && <HeroOrbFallback className="absolute inset-0" />}
      {!failed && <canvas ref={canvas} aria-hidden="true" data-ready={ready || undefined} className="absolute inset-0 size-full" />}
    </div>
  );
}
