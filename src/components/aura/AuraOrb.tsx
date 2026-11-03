"use client";

import { useEffect, useRef, useState } from "react";

/**
 * AURA 7H — sello visual de la marca: una esfera de vidrio líquido con luz dorada.
 * WebGL puro (un shader de pocos KB, sin Three.js):
 * - Se dibuja a resolución reducida y como máximo a 1.5x de densidad de píxeles.
 * - Se pausa cuando no está en pantalla o la pestaña está oculta.
 * - Responde suavemente al cursor (solo con mouse).
 * - Sin WebGL o con "reducir movimiento": muestra una esfera estática hecha con CSS (AuraFallback).
 */

const VERT = `attribute vec2 p; void main(){ gl_Position = vec4(p, 0.0, 1.0); }`;

const FRAG = `
precision highp float;
uniform vec2 uRes; uniform float uTime; uniform vec2 uMouse;

float sdf(vec3 p){
  float t = uTime * 0.55;
  vec3 q = p;
  q.xy += uMouse * 0.18;
  float d = length(q) - 1.0;
  d -= 0.12 * sin(2.6*q.x + t) * sin(2.3*q.y + t*1.3) * sin(2.9*q.z + t*0.8);
  d -= 0.05 * sin(5.0*q.y - t*1.7 + sin(3.0*q.x + t));
  return d * 0.8;
}
vec3 nrm(vec3 p){
  vec2 e = vec2(0.002, 0.0);
  return normalize(vec3(sdf(p+e.xyy)-sdf(p-e.xyy), sdf(p+e.yxy)-sdf(p-e.yxy), sdf(p+e.yyx)-sdf(p-e.yyx)));
}
vec3 pal(float t){ // iridiscencia acotada a oros, marfil y un toque frío
  return 0.5 + 0.5 * cos(6.2831 * (vec3(0.0, 0.08, 0.2) + t));
}
void main(){
  vec2 uv = (gl_FragCoord.xy - 0.5 * uRes) / min(uRes.x, uRes.y);
  vec3 ro = vec3(0.0, 0.0, 3.2);
  vec3 rd = normalize(vec3(uv, -1.55));
  float t = 0.0; float hit = 0.0;
  for (int i = 0; i < 56; i++) {
    float d = sdf(ro + rd * t);
    if (d < 0.0015) { hit = 1.0; break; }
    t += d;
    if (t > 6.0) break;
  }
  if (hit < 0.5) { gl_FragColor = vec4(0.0); return; }
  vec3 p = ro + rd * t;
  vec3 n = nrm(p);
  vec3 l1 = normalize(vec3(0.6 + uMouse.x * 0.6, 0.8 + uMouse.y * 0.4, 0.7));
  vec3 l2 = normalize(vec3(-0.8, -0.3, 0.4));
  float fres = pow(1.0 - max(dot(n, -rd), 0.0), 2.4);
  float dif = max(dot(n, l1), 0.0);
  float spec = pow(max(dot(reflect(-l1, n), -rd), 0.0), 64.0);
  float rim = pow(max(dot(n, l2), 0.0), 2.0);
  vec3 gold = vec3(0.79, 0.64, 0.30);
  vec3 ivory = vec3(0.96, 0.94, 0.91);
  vec3 iri = pal(n.y * 0.35 + n.x * 0.25 + uTime * 0.05);
  vec3 base = mix(vec3(0.05, 0.045, 0.04), gold, 0.35 + 0.45 * dif);
  vec3 col = base;
  col = mix(col, iri * gold * 1.6, 0.35 * fres + 0.12);
  col += vec3(0.35, 0.45, 0.85) * pow(fres, 3.0) * 0.45; // reflejo frío de vidrio en el borde
  col += ivory * spec * 1.2;
  col += gold * rim * 0.35;
  col += vec3(1.0, 0.86, 0.55) * fres * 0.55;
  col = pow(col, vec3(0.92));
  float alpha = clamp(0.85 + fres * 0.15, 0.0, 1.0);
  gl_FragColor = vec4(col, alpha);
}`;

export function AuraFallback({ className = "" }: { className?: string }) {
  return (
    <div aria-hidden="true" className={`relative ${className}`}>
      <div className="absolute inset-[8%] rounded-full bg-[radial-gradient(circle_at_32%_28%,#fff6dc_0%,#d8b866_18%,#8a6a2a_45%,#1a1610_72%)] shadow-[0_40px_120px_-20px_rgb(201_164_76_/_.55)]" />
      <div className="absolute inset-[8%] rounded-full bg-[radial-gradient(circle_at_70%_80%,rgb(120_160_255_/_.25),transparent_45%)] mix-blend-screen" />
      <div className="absolute left-[24%] top-[18%] h-[14%] w-[22%] rotate-[-25deg] rounded-full bg-white/50 blur-md" />
    </div>
  );
}

export default function AuraOrb({ className = "" }: { className?: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [fallback, setFallback] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return setFallback(true);
    const gl = canvas.getContext("webgl", { alpha: true, antialias: false, premultipliedAlpha: false, powerPreference: "low-power" });
    if (!gl) return setFallback(true);

    const compile = (type: number, src: string) => {
      const s = gl.createShader(type)!;
      gl.shaderSource(s, src);
      gl.compileShader(s);
      return gl.getShaderParameter(s, gl.COMPILE_STATUS) ? s : null;
    };
    const vs = compile(gl.VERTEX_SHADER, VERT);
    const fs = compile(gl.FRAGMENT_SHADER, FRAG);
    if (!vs || !fs) return setFallback(true);
    const prog = gl.createProgram()!;
    gl.attachShader(prog, vs);
    gl.attachShader(prog, fs);
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return setFallback(true);
    gl.useProgram(prog);
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(prog, "p");
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    const uRes = gl.getUniformLocation(prog, "uRes");
    const uTime = gl.getUniformLocation(prog, "uTime");
    const uMouse = gl.getUniformLocation(prog, "uMouse");

    // Resolución reducida: en celulares el costo baja mucho y la esfera se ve igual de suave.
    const mobile = window.matchMedia("(max-width: 767px)").matches;
    const scale = Math.min(window.devicePixelRatio || 1, 1.5) * (mobile ? 0.6 : 0.8);
    const resize = () => {
      const r = canvas.getBoundingClientRect();
      canvas.width = Math.max(1, Math.round(r.width * scale));
      canvas.height = Math.max(1, Math.round(r.height * scale));
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.uniform2f(uRes, canvas.width, canvas.height);
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    const target = { x: 0, y: 0 };
    const mouse = { x: 0, y: 0 };
    const fine = window.matchMedia("(pointer: fine)").matches;
    const onMove = (e: PointerEvent) => {
      target.x = (e.clientX / window.innerWidth) * 2 - 1;
      target.y = -((e.clientY / window.innerHeight) * 2 - 1);
    };
    if (fine) window.addEventListener("pointermove", onMove, { passive: true });

    let visible = true;
    const io = new IntersectionObserver(([en]) => { visible = en.isIntersecting; if (visible) loop(); }, { threshold: 0.01 });
    io.observe(canvas);

    let raf = 0;
    const start = performance.now();
    function loop() {
      cancelAnimationFrame(raf);
      if (!visible || document.hidden) return;
      mouse.x += (target.x - mouse.x) * 0.05;
      mouse.y += (target.y - mouse.y) * 0.05;
      gl!.uniform1f(uTime, (performance.now() - start) / 1000);
      gl!.uniform2f(uMouse, mouse.x, mouse.y);
      gl!.clearColor(0, 0, 0, 0);
      gl!.clear(gl!.COLOR_BUFFER_BIT);
      gl!.drawArrays(gl!.TRIANGLES, 0, 3);
      raf = requestAnimationFrame(loop);
    }
    const onVis = () => { if (!document.hidden) loop(); };
    document.addEventListener("visibilitychange", onVis);
    loop();

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      io.disconnect();
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("pointermove", onMove);
      gl.getExtension("WEBGL_lose_context")?.loseContext();
    };
  }, []);

  if (fallback) return <AuraFallback className={className} />;
  return <canvas ref={canvasRef} aria-hidden="true" className={`block ${className}`} />;
}
