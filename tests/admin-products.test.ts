import { beforeEach, describe, expect, it } from "vitest";
import { productInput, type ProductFormInput } from "@/lib/schemas/admin";
import { createProduct, deleteProduct, ProductError, setProductActive, setStock, updateProduct } from "@/lib/services/admin-products";
import { createFakeDb } from "./helpers/fake-db";

let f: ReturnType<typeof createFakeDb>;
const form = (over: Partial<ProductFormInput> = {}) =>
  productInput.parse({
    name: "Nike Air Max 270", brand: "Nike", description: "Tenis deportivos de uso diario.", priceCOP: 599000, category: "calzado",
    images: ["https://images.unsplash.com/photo-1"], variants: [{ size: "40", stock: 1 }, { size: "36", stock: 2 }, { size: "38", stock: 3 }], ...over,
  });
beforeEach(() => { f = createFakeDb(); f.seed.category("calzado"); f.seed.category("tecnologia"); });

describe("crear producto", () => {
  it("crea con tallas: variantes ordenadas, stock total y slug automático", async () => {
    const p = await createProduct(form(), f.db);
    expect(p.slug).toBe("nike-air-max-270");
    expect(p.sizes).toEqual(["36", "38", "40"]);
    expect(p.stock).toBe(6);
    expect(p.active).toBe(true);
    expect(f.state.productVariant.map((v) => [v.size, v.stock])).toEqual([["36", 2], ["38", 3], ["40", 1]]);
  });
  it("crea un producto sin tallas (Garmin) con stock 10 y sin variantes", async () => {
    const p = await createProduct(form({ name: "Garmin Forerunner 255", brand: "Garmin", category: "tecnologia", variants: [], stock: 10 }), f.db);
    expect(p.stock).toBe(10);
    expect(p.sizes).toEqual([]);
    expect(f.state.productVariant).toHaveLength(0);
  });
  it("rechaza slug o nombre+marca duplicados (409)", async () => {
    await createProduct(form(), f.db);
    await expect(createProduct(form(), f.db)).rejects.toMatchObject({ status: 409 });
    await expect(createProduct(form({ slug: "otro-slug", name: "nike air max 270", brand: "NIKE" }), f.db)).rejects.toMatchObject({ status: 409 });
  });
  it("no se guarda si la categoría no existe", async () => {
    await expect(createProduct(form({ category: "ropa" }), f.db)).rejects.toBeInstanceOf(ProductError);
  });
});

describe("editar producto y stock por talla", () => {
  it("actualiza datos, agrega tallas, quita las que no tienen pedidos y recalcula el total", async () => {
    const p = await createProduct(form(), f.db);
    const updated = await updateProduct(p.id, form({ priceCOP: 550000, variants: [{ size: "36", stock: 9 }, { size: "41", stock: 4 }] }), f.db);
    expect(updated.priceCOP).toBe(550000);
    expect(updated.sizes).toEqual(["36", "41"]);
    expect(updated.stock).toBe(13);
    expect(f.state.productVariant.map((v) => v.size).sort()).toEqual(["36", "41"]);
  });
  it("una talla con pedidos no se borra: queda en stock 0 (historial intacto)", async () => {
    const p = await createProduct(form(), f.db);
    const v40 = f.state.productVariant.find((v) => v.size === "40")!;
    const o = f.seed.order();
    f.seed.item(o.id, p.id, 1, v40.id, "40");
    const updated = await updateProduct(p.id, form({ variants: [{ size: "36", stock: 2 }] }), f.db);
    expect(f.state.productVariant.find((v) => v.size === "40")!.stock).toBe(0);
    expect(updated.sizes).toContain("40");
  });
  it("no deja quitar todas las tallas si alguna tiene pedidos", async () => {
    const p = await createProduct(form(), f.db);
    const v40 = f.state.productVariant.find((v) => v.size === "40")!;
    f.seed.item(f.seed.order().id, p.id, 1, v40.id, "40");
    await expect(updateProduct(p.id, form({ variants: [], stock: 5 }), f.db)).rejects.toMatchObject({ status: 409 });
  });
  it("setStock por talla actualiza la talla y recalcula el total", async () => {
    const p = await createProduct(form(), f.db);
    const v = f.state.productVariant.find((x) => x.size === "40")!;
    const res = await setStock(p.id, { variants: [{ id: v.id, stock: 0 }] }, f.db);
    expect(f.state.productVariant.find((x) => x.id === v.id)!.stock).toBe(0);
    expect(res.stock).toBe(5);
  });
  it("setStock rechaza tallas ajenas y mezclar modos", async () => {
    const p = await createProduct(form(), f.db);
    await expect(setStock(p.id, { variants: [{ id: "otra", stock: 1 }] }, f.db)).rejects.toMatchObject({ status: 400 });
    await expect(setStock(p.id, { stock: 5 }, f.db)).rejects.toMatchObject({ status: 400 });
  });
  it("setStock en producto sin tallas", async () => {
    const p = await createProduct(form({ category: "tecnologia", variants: [], stock: 10 }), f.db);
    expect((await setStock(p.id, { stock: 4 }, f.db)).stock).toBe(4);
    await expect(setStock(p.id, { variants: [{ id: "x", stock: 1 }] }, f.db)).rejects.toMatchObject({ status: 400 });
  });
  it("editar un producto inexistente → 404", async () => {
    await expect(updateProduct("nope", form(), f.db)).rejects.toMatchObject({ status: 404 });
  });
});

describe("activar/desactivar y eliminar", () => {
  it("desactiva y reactiva sin borrar nada", async () => {
    const p = await createProduct(form(), f.db);
    await setProductActive(p.id, false, f.db);
    expect(f.state.product[0].active).toBe(false);
    await setProductActive(p.id, true, f.db);
    expect(f.state.product[0].active).toBe(true);
  });
  it("NO elimina productos con pedidos: exige desactivarlos", async () => {
    const p = await createProduct(form(), f.db);
    f.seed.item(f.seed.order().id, p.id, 1);
    await expect(deleteProduct(p.id, f.db)).rejects.toMatchObject({ status: 409 });
    expect(f.state.product).toHaveLength(1);
  });
  it("elimina productos sin pedidos junto con sus tallas", async () => {
    const p = await createProduct(form(), f.db);
    await deleteProduct(p.id, f.db);
    expect(f.state.product).toHaveLength(0);
    expect(f.state.productVariant).toHaveLength(0);
  });
});
