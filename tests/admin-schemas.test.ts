import { describe, expect, it } from "vitest";
import { orderActionInput, productInput, slugify, stockInput } from "@/lib/schemas/admin";
import { isValidSize, sortSizes, splitStock, stockForSize } from "@/lib/sizes";
import { detectImageType } from "@/lib/images";

const base = {
  name: "Nike Air Max 270", brand: "Nike", description: "Tenis deportivos de uso diario.", priceCOP: 599000, category: "calzado",
  images: ["https://images.unsplash.com/photo-1"], variants: [{ size: "36", stock: 2 }, { size: "40", stock: 1 }],
};
const issues = (input: unknown) => { const r = productInput.safeParse(input); return r.success ? [] : r.error.issues.map((i) => i.message); };

describe("validación de producto", () => {
  it("acepta un producto válido con tallas", () => expect(productInput.safeParse(base).success).toBe(true));
  it("acepta un producto sin tallas con stock", () => expect(productInput.safeParse({ ...base, category: "tecnologia", variants: [], stock: 10 }).success).toBe(true));
  it("exige nombre", () => expect(issues({ ...base, name: " " }).length).toBeGreaterThan(0));
  it("exige precio > 0", () => { expect(issues({ ...base, priceCOP: 0 })).toContain("El precio debe ser mayor a 0"); expect(issues({ ...base, priceCOP: -5 }).length).toBeGreaterThan(0); });
  it("rechaza stock negativo", () => { expect(issues({ ...base, variants: [], stock: -1 })).toContain("El stock no puede ser negativo"); expect(issues({ ...base, variants: [{ size: "40", stock: -1 }] }).length).toBeGreaterThan(0); });
  it("rechaza stock decimal", () => expect(issues({ ...base, variants: [{ size: "40", stock: 1.5 }] }).length).toBeGreaterThan(0));
  it("“todo” NO es una categoría válida", () => { expect(issues({ ...base, category: "todo" }).length).toBeGreaterThan(0); expect(issues({ ...base, category: "otra" }).length).toBeGreaterThan(0); });
  it("exige al menos una imagen", () => expect(issues({ ...base, images: [] })).toContain("Agrega al menos una imagen"));
  it("rechaza imágenes de hosts no permitidos o http", () => { expect(issues({ ...base, images: ["https://evil.com/a.jpg"] }).length).toBeGreaterThan(0); expect(issues({ ...base, images: ["http://images.unsplash.com/a.jpg"] }).length).toBeGreaterThan(0); });
  it("rechaza tallas repetidas", () => expect(issues({ ...base, variants: [{ size: "40", stock: 1 }, { size: "40", stock: 2 }] }).some((m) => m.includes("repetida"))).toBe(true));
  it("valida tallas según categoría", () => { expect(issues({ ...base, variants: [{ size: "XL", stock: 1 }] }).length).toBeGreaterThan(0); expect(issues({ ...base, category: "ropa", variants: [{ size: "XL", stock: 1 }] })).toEqual([]); });
  it("precio anterior debe ser mayor al actual", () => expect(issues({ ...base, compareAtPriceCOP: 500000 }).length).toBeGreaterThan(0));
  it("normaliza la talla a mayúsculas", () => { const r = productInput.parse({ ...base, category: "ropa", variants: [{ size: "xl", stock: 1 }] }); expect(r.variants[0].size).toBe("XL"); });
});

describe("otros esquemas", () => {
  it("stock: acepta producto sin tallas o por talla, rechaza negativos", () => {
    expect(stockInput.safeParse({ stock: 5 }).success).toBe(true);
    expect(stockInput.safeParse({ variants: [{ id: "v1", stock: 0 }] }).success).toBe(true);
    expect(stockInput.safeParse({ stock: -1 }).success).toBe(false);
    expect(stockInput.safeParse({ variants: [{ id: "v1", stock: -3 }] }).success).toBe(false);
  });
  it("acciones de pedido: no existe forma de poner PAID ni EXPIRED manualmente", () => {
    expect(orderActionInput.safeParse({ action: "status", status: "PAID" }).success).toBe(false);
    expect(orderActionInput.safeParse({ action: "status", status: "EXPIRED" }).success).toBe(false);
    expect(orderActionInput.safeParse({ action: "status", status: "SHIPPED", carrier: "X", trackingNumber: "1" }).success).toBe(true);
    expect(orderActionInput.safeParse({ action: "confirm_manual_payment" }).success).toBe(true);
  });
  it("slugify quita tildes y símbolos", () => expect(slugify("Camiseta Básica -  Niño!")).toBe("camiseta-basica-nino"));
});

describe("tallas", () => {
  it("valida calzado y ropa", () => {
    expect(isValidSize("calzado", "40.5")).toBe(true); expect(isValidSize("calzado", "40.3")).toBe(false); expect(isValidSize("calzado", "XL")).toBe(false);
    expect(isValidSize("ropa", "m")).toBe(true); expect(isValidSize("ropa", "32")).toBe(true); expect(isValidSize("ropa", "ZZ")).toBe(false);
  });
  it("ordena numéricas y de ropa", () => { expect(sortSizes(["42", "36", "40"])).toEqual(["36", "40", "42"]); expect(sortSizes(["XL", "S", "M", "L"])).toEqual(["S", "M", "L", "XL"]); });
  it("reparte stock sin perder unidades", () => { expect(splitStock(10, 3)).toEqual([4, 3, 3]); expect(splitStock(0, 4)).toEqual([0, 0, 0, 0]); });
  it("stockForSize usa la talla o el stock del producto", () => {
    expect(stockForSize({ stock: 4, variants: [{ size: "S", stock: 4 }, { size: "M", stock: 0 }] }, "M")).toBe(0);
    expect(stockForSize({ stock: 4, variants: [{ size: "S", stock: 4 }] }, undefined)).toBe(0);
    expect(stockForSize({ stock: 10 }, undefined)).toBe(10);
  });
});

describe("imágenes", () => {
  it("detecta el formato por contenido, no por extensión", () => {
    expect(detectImageType(Uint8Array.from([0xff, 0xd8, 0xff, 0xe0]))?.mime).toBe("image/jpeg");
    expect(detectImageType(Uint8Array.from([0x89, 0x50, 0x4e, 0x47]))?.mime).toBe("image/png");
    expect(detectImageType(new TextEncoder().encode("<svg onload=alert(1)>"))).toBeNull();
  });
});
