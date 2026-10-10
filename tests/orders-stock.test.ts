import { beforeEach, describe, expect, it } from "vitest";
import { createOrder } from "@/lib/services/orders";
import { mergeLines } from "@/lib/stock";
import { checkoutBase, createFakeDb } from "./helpers/fake-db";

let f: ReturnType<typeof createFakeDb>;
const buy = (items: { productId: string; size?: string; quantity: number }[]) => createOrder({ ...checkoutBase, items }, f.db);
const stockOf = (id: string) => f.state.productVariant.find((v) => v.id === id)!.stock;

beforeEach(() => { f = createFakeDb(); f.seed.category("calzado"); });

describe("stock por talla al crear pedido", () => {
  it("Nike Air Max talla 40 con stock 1: 1 → 0 y queda agotada", async () => {
    const p = f.seed.product({ name: "Nike Air Max", sizes: ["39", "40"], stock: 4 });
    f.seed.variant(p.id, "39", 3);
    const v40 = f.seed.variant(p.id, "40", 1);
    const order = await buy([{ productId: p.id, size: "40", quantity: 1 }]);
    expect(stockOf(v40.id)).toBe(0);
    expect(order.status).toBe("PENDING_PAYMENT");
    expect(f.state.orderItem[0]).toMatchObject({ variantId: v40.id, size: "40", quantity: 1 });
  });
  it("impide comprar una talla agotada", async () => {
    const p = f.seed.product({ sizes: ["38"] });
    const v = f.seed.variant(p.id, "38", 0);
    await expect(buy([{ productId: p.id, size: "38", quantity: 1 }])).rejects.toThrow("OUT_OF_STOCK");
    expect(stockOf(v.id)).toBe(0);
    expect(f.state.order).toHaveLength(0);
  });
  it("impide pedir más de lo disponible y nunca deja stock negativo", async () => {
    const p = f.seed.product({ sizes: ["S"] });
    const v = f.seed.variant(p.id, "S", 2);
    await expect(buy([{ productId: p.id, size: "S", quantity: 3 }])).rejects.toThrow("OUT_OF_STOCK");
    expect(stockOf(v.id)).toBe(2);
  });
  it("el segundo comprador de la última unidad es rechazado (sobreventa)", async () => {
    const p = f.seed.product({ sizes: ["M"] });
    const v = f.seed.variant(p.id, "M", 1);
    await buy([{ productId: p.id, size: "M", quantity: 1 }]);
    await expect(buy([{ productId: p.id, size: "M", quantity: 1 }])).rejects.toThrow("OUT_OF_STOCK");
    expect(stockOf(v.id)).toBe(0);
  });
  it("líneas repetidas se suman: no se puede evadir el límite dividiendo la cantidad", async () => {
    const p = f.seed.product({ sizes: ["M"] });
    const v = f.seed.variant(p.id, "M", 2);
    await expect(buy([{ productId: p.id, size: "M", quantity: 2 }, { productId: p.id, size: "M", quantity: 2 }])).rejects.toThrow("OUT_OF_STOCK");
    expect(stockOf(v.id)).toBe(2);
  });
  it("si una línea falla se revierte TODO el pedido (transacción)", async () => {
    const a = f.seed.product({ sizes: ["S"] });
    const va = f.seed.variant(a.id, "S", 5);
    const b = f.seed.product({ sizes: ["S"] });
    f.seed.variant(b.id, "S", 0);
    await expect(buy([{ productId: a.id, size: "S", quantity: 2 }, { productId: b.id, size: "S", quantity: 1 }])).rejects.toThrow("OUT_OF_STOCK");
    expect(stockOf(va.id)).toBe(5);
    expect(f.state.order).toHaveLength(0);
  });
  it("rechaza talla inexistente o ausente en productos con tallas", async () => {
    const p = f.seed.product({ sizes: ["40"] });
    f.seed.variant(p.id, "40", 5);
    await expect(buy([{ productId: p.id, size: "99", quantity: 1 }])).rejects.toThrow("INVALID_SIZE");
    await expect(buy([{ productId: p.id, quantity: 1 }])).rejects.toThrow("INVALID_SIZE");
  });
  it("rechaza productos desactivados aunque estén en un carrito viejo", async () => {
    const p = f.seed.product({ active: false, stock: 5 });
    await expect(buy([{ productId: p.id, quantity: 1 }])).rejects.toThrow("PRODUCT_NOT_FOUND");
  });
});

describe("productos sin tallas (Garmin Forerunner 255)", () => {
  it("se compra directo y descuenta del stock del producto", async () => {
    const p = f.seed.product({ name: "Garmin Forerunner 255", stock: 10, priceCOP: 1_200_000 });
    const order = await buy([{ productId: p.id, quantity: 2 }]);
    expect(f.state.product.find((x) => x.id === p.id)!.stock).toBe(8);
    expect(order.subtotalCOP).toBe(2_400_000);
    expect(order.shippingCOP).toBe(0);
    expect(f.state.orderItem[0].variantId).toBeNull();
  });
  it("rechaza cantidades mayores al stock", async () => {
    const p = f.seed.product({ stock: 1 });
    await expect(buy([{ productId: p.id, quantity: 2 }])).rejects.toThrow("OUT_OF_STOCK");
  });
});

describe("compatibilidad con productos aún sin variantes", () => {
  it("producto con `sizes` y stock global sigue funcionando", async () => {
    const p = f.seed.product({ sizes: ["S", "M"], stock: 3 });
    await buy([{ productId: p.id, size: "M", quantity: 1 }]);
    expect(f.state.product.find((x) => x.id === p.id)!.stock).toBe(2);
  });
});

describe("mergeLines", () => {
  it("agrupa por producto y talla", () => {
    expect(mergeLines([{ productId: "a", size: "M", quantity: 1 }, { productId: "a", size: "M", quantity: 2 }, { productId: "a", size: "L", quantity: 1 }])).toEqual([
      { productId: "a", size: "M", quantity: 3 }, { productId: "a", size: "L", quantity: 1 },
    ]);
  });
});
