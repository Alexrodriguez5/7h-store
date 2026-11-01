import { describe, expect, it } from "vitest";
import { applyFilters } from "@/lib/filters";
import type { FilterState, Product } from "@/types";

const base: FilterState = { search: "", category: "todo", gender: "todos", onlyAccessories: false, maxPriceCOP: null, sort: "relevancia" };
// Ordenados como los entrega la base de datos: más nuevo primero.
const products: Product[] = [
  { id: "3", slug: "c", name: "Audífonos inalámbricos", brand: "Sony", description: "Cancelación de ruido", priceCOP: 900000, category: "tecnologia", gender: "unisex", isAccessory: false, images: [], stock: 0, tags: ["audio"], featured: false },
  { id: "1", slug: "a", name: "Tenis Blanco", brand: "Marca", description: "", priceCOP: 300000, category: "calzado", gender: "mujer", isAccessory: false, images: [], stock: 2, tags: ["tenis"], featured: true },
  { id: "2", slug: "b", name: "Reloj", brand: "Marca", description: "", priceCOP: 600000, category: "accesorios", gender: "unisex", isAccessory: true, images: [], stock: 2, tags: ["reloj"], featured: false },
];
const ids = (r: Product[]) => r.map((p) => p.id);

describe("applyFilters", () => {
  it("filtra categoría", () => expect(applyFilters(products, { ...base, category: "calzado" })).toHaveLength(1));
  it("ordena precio", () => expect(applyFilters(products, { ...base, sort: "precio-desc" })[0].priceCOP).toBe(900000));
  it("novedades conserva el orden más nuevo primero", () => expect(ids(applyFilters(products, { ...base, sort: "novedades" }))).toEqual(["3", "1", "2"]));
  it("relevancia pone destacados y con stock primero", () => expect(ids(applyFilters(products, { ...base, sort: "relevancia" }))).toEqual(["1", "2", "3"]));
  it("busca sin importar tildes ni mayúsculas", () => expect(ids(applyFilters(products, { ...base, search: "AUDIFONOS" }))).toEqual(["3"]));
  it("busca en marca, categoría y descripción con varias palabras", () => {
    expect(ids(applyFilters(products, { ...base, search: "sony ruido" }))).toEqual(["3"]);
    expect(ids(applyFilters(products, { ...base, search: "tecnologia" }))).toEqual(["3"]);
    expect(applyFilters(products, { ...base, search: "sony tenis" })).toHaveLength(0);
  });
  it("unisex aparece al filtrar por género", () => expect(ids(applyFilters(products, { ...base, gender: "hombre" }))).toEqual(["2", "3"]));
});
