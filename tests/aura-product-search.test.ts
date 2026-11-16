import { describe, expect, it } from "vitest";
import { rankProducts } from "@/lib/aura/product-search";
import { getClientIpFromHeaders } from "@/lib/request";

const p = (name: string, brand: string, category: string, extra: Partial<{ description: string; tags: string[]; color: string }> = {}) => ({
  name, brand, category: { label: category }, description: extra.description ?? "", tags: extra.tags ?? [], color: extra.color ?? null,
});

const catalog = [
  p("Cámara instantánea Mini 12", "Fujifilm", "Tecnología", { description: "Cámara de fotos instantáneas" }),
  p("Zapatillas Air Max 90", "Nike", "Calzado", { tags: ["tenis"] }),
  p("Audífonos inalámbricos WH-1000XM5", "Sony", "Tecnología", { description: "Cancelación de ruido" }),
  p("Gorra clásica", "New Era", "Accesorios", { color: "Negro" }),
];

describe("búsqueda de productos de AURA (BUG-05)", () => {
  it("no distingue tildes ni mayúsculas", () => {
    expect(rankProducts("camara", catalog).map((x) => x.brand)).toEqual(["Fujifilm"]);
    expect(rankProducts("AUDIFONOS", catalog).map((x) => x.brand)).toEqual(["Sony"]);
  });

  it("compara por raíz (singular y plural)", () => {
    expect(rankProducts("zapatilla nike", catalog).map((x) => x.brand)).toEqual(["Nike"]);
  });

  it("tolera errores de escritura frecuentes", () => {
    expect(rankProducts("audifonoz sony", catalog).map((x) => x.brand)).toContain("Sony");
  });

  it("no exige todas las palabras y ordena por relevancia", () => {
    const r = rankProducts("quiero unos audifonos baratos", catalog);
    expect(r[0]?.brand).toBe("Sony");
  });

  it("no devuelve nada cuando no hay coincidencias o la consulta es vacía", () => {
    expect(rankProducts("bicicleta", catalog)).toEqual([]);
    expect(rankProducts("hola por favor", catalog)).toEqual([]);
  });

  it("respeta el límite", () => {
    expect(rankProducts("tecnologia", catalog, 1)).toHaveLength(1);
  });
});

describe("getClientIpFromHeaders", () => {
  it("usa x-real-ip, luego el primer x-forwarded-for", () => {
    expect(getClientIpFromHeaders(new Headers({ "x-real-ip": "1.1.1.1", "x-forwarded-for": "2.2.2.2" }))).toBe("1.1.1.1");
    expect(getClientIpFromHeaders(new Headers({ "x-forwarded-for": "3.3.3.3, 4.4.4.4" }))).toBe("3.3.3.3");
    expect(getClientIpFromHeaders(new Headers())).toBe("unknown");
  });
});
