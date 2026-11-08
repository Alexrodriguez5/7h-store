import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  // JSX automático, como en Next (los módulos de contenido con JSX se pueden importar en pruebas).
  esbuild: { jsx: "automatic" },
  test: { environment: "jsdom", setupFiles: ["./tests/setup.ts"] },
  resolve: { alias: { "@": path.resolve(__dirname, "./src") } }
});
