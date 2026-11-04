import { describe, expect, it } from "vitest";
import { productBadges } from "@/lib/badges";
import { productInput } from "@/lib/schemas/admin";

const now = new Date("2026-11-04T00:00:00Z");
const base = { stock: 10, priceCOP: 100_000, createdAt: "2026-01-01T00:00:00Z" };
const keys = (p: Parameters<typeof productBadges>[0]) => productBadges(p, now).map((b) => b.key);

describe("etiquetas de producto", () => {
  it("no muestra nada si no hay datos que lo respalden", () => {
    expect(keys(base)).toEqual([]);
  });
  it("agotado y últimas unidades salen del inventario", () => {
    expect(keys({ ...base, stock: 0 })).toEqual(["AGOTADO"]);
    expect(keys({ ...base, stock: 2 })).toEqual(["ULTIMAS"]);
  });
  it("oferta solo con precio anterior mayor y producto disponible", () => {
    expect(keys({ ...base, compareAtPriceCOP: 125_000 })).toEqual(["OFERTA"]);
    expect(keys({ ...base, compareAtPriceCOP: 90_000 })).toEqual([]);
    expect(keys({ ...base, stock: 0, compareAtPriceCOP: 125_000 })).toEqual(["AGOTADO"]);
  });
  it("nuevo solo durante los primeros 30 días", () => {
    expect(keys({ ...base, createdAt: "2026-10-20T00:00:00Z" })).toEqual(["NUEVO"]);
    expect(keys({ ...base, createdAt: "2026-09-01T00:00:00Z" })).toEqual([]);
  });
  it("las manuales solo si el admin las marcó, e ignora claves desconocidas", () => {
    expect(keys({ ...base, badges: ["ORIGINAL", "INVENTADA"] })).toEqual(["ORIGINAL"]);
  });
});

describe("ficha del producto en el formulario admin", () => {
  const valid = { name: "Tenis 530", brand: "New Balance", description: "Descripción suficiente", priceCOP: 1000, category: "calzado", images: ["https://images.unsplash.com/x.jpg"] };
  it("rechaza etiquetas que no existen y videos no permitidos", () => {
    expect(productInput.safeParse({ ...valid, badges: ["FALSA"] }).success).toBe(false);
    expect(productInput.safeParse({ ...valid, videoUrl: "http://youtube.com/watch?v=1" }).success).toBe(false);
    expect(productInput.safeParse({ ...valid, videoUrl: "https://evil.example/x.html" }).success).toBe(false);
  });
  it("acepta YouTube y guarda vacíos como null", () => {
    const r = productInput.parse({ ...valid, videoUrl: "https://www.youtube.com/watch?v=abc", model: "", badges: ["ORIGINAL"] });
    expect(r.videoUrl).toBe("https://www.youtube.com/watch?v=abc");
    expect(r.model).toBeNull();
    expect(r.badges).toEqual(["ORIGINAL"]);
  });
});
