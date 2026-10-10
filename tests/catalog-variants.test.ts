import { beforeEach, describe, expect, it } from "vitest";
import { mapProduct } from "@/services/products";
import { useCartStore } from "@/store/cart-store";
import type { Product } from "@/types";

const row = (over = {}) => ({
  id: "p1", slug: "nike", name: "Nike", brand: "Nike", description: "d", priceCOP: 100000, compareAtPriceCOP: null, gender: "UNISEX", isAccessory: false,
  images: ["x"], sizes: [] as string[], stock: 0, tags: [], featured: false, category: { slug: "calzado" }, variants: [] as { id: string; size: string; stock: number }[], ...over,
});

describe("mapProduct con variantes", () => {
  it("usa las variantes: tallas ordenadas, agotadas incluidas con stock 0, stock = suma", () => {
    const p = mapProduct(row({ stock: 999, variants: [{ id: "c", size: "40", stock: 1 }, { id: "a", size: "36", stock: 0 }, { id: "b", size: "38", stock: 2 }] }));
    expect(p.sizes).toEqual(["36", "38", "40"]);
    expect(p.variants?.map((v) => v.stock)).toEqual([0, 2, 1]);
    expect(p.stock).toBe(3);
  });
  it("producto sin tallas (Garmin): sin selector y con stock propio", () => {
    const p = mapProduct(row({ stock: 10 }));
    expect(p.sizes).toBeUndefined();
    expect(p.variants).toBeUndefined();
    expect(p.stock).toBe(10);
  });
  it("todas las tallas en 0 ⇒ producto agotado", () => {
    expect(mapProduct(row({ variants: [{ id: "a", size: "S", stock: 0 }] })).stock).toBe(0);
  });
});

describe("carrito con stock por talla", () => {
  const shoe: Product = { ...mapProduct(row({ variants: [{ id: "a", size: "38", stock: 0 }, { id: "b", size: "40", stock: 2 }] })) };
  beforeEach(() => useCartStore.setState({ items: [], isOpen: false }));

  it("no agrega una talla agotada", () => { useCartStore.getState().addItem(shoe, "38"); expect(useCartStore.getState().items).toHaveLength(0); });
  it("no agrega sin elegir talla cuando el producto las maneja", () => { useCartStore.getState().addItem(shoe); expect(useCartStore.getState().items).toHaveLength(0); });
  it("limita la cantidad al stock de ESA talla", () => {
    for (let i = 0; i < 5; i++) useCartStore.getState().addItem(shoe, "40");
    const [item] = useCartStore.getState().items;
    expect(item.quantity).toBe(2);
    expect(item.stock).toBe(2);
  });
});
