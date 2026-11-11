import type { MetadataRoute } from "next";

/** Datos de la app para navegadores y buscadores (nombre, colores e íconos de la marca). */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "7H STORE",
    short_name: "7H STORE",
    description: "Moda, calzado, accesorios y tecnología originales de Estados Unidos, con envío a toda Colombia.",
    start_url: "/",
    display: "standalone",
    background_color: "#0A0A0A",
    theme_color: "#0A0A0A",
    lang: "es-CO",
    icons: [
      { src: "/icon.png", sizes: "192x192", type: "image/png" },
      { src: "/logo-512.png", sizes: "512x512", type: "image/png" },
    ],
  };
}
