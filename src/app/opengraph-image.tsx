import { ImageResponse } from "next/og";

/** Imagen para compartir en redes (WhatsApp, Facebook, X) cuando una página no tiene foto propia. */
export const alt = "7H STORE — Calidad. Estilo. Confianza.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", background: "#0A0A0A", color: "#F5F1E8" }}>
        <div style={{ fontSize: 120, letterSpacing: 18, color: "#D8B866", fontFamily: "serif" }}>7H STORE</div>
        <div style={{ marginTop: 18, width: 160, height: 3, background: "#C9A44C" }} />
        <div style={{ marginTop: 28, fontSize: 40, fontFamily: "serif" }}>Calidad. Estilo. Confianza.</div>
        <div style={{ marginTop: 22, fontSize: 26, color: "rgba(245,241,232,0.7)" }}>Productos originales de EE.UU. · Envíos a toda Colombia</div>
      </div>
    ),
    size,
  );
}
