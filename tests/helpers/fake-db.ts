/* eslint-disable @typescript-eslint/no-explicit-any */
import type { PrismaClient } from "@prisma/client";

type Row = Record<string, any>;

function matches(row: Row, where: Row | undefined): boolean {
  for (const [k, cond] of Object.entries(where ?? {})) {
    if (k === "productId_size") { if (row.productId !== cond.productId || row.size !== cond.size) return false; continue; }
    const val = row[k];
    if (cond && typeof cond === "object" && !(cond instanceof Date)) {
      if ("in" in cond && !cond.in.includes(val)) return false;
      if ("gte" in cond && !(val >= cond.gte)) return false;
      if ("lt" in cond && !(val < cond.lt)) return false;
      if ("not" in cond && val === cond.not) return false;
      if ("equals" in cond && String(val).toLowerCase() !== String(cond.equals).toLowerCase()) return false;
    } else if (val !== cond) return false;
  }
  return true;
}

function applyData(row: Row, data: Row) {
  for (const [k, v] of Object.entries(data)) {
    if (v && typeof v === "object" && !(v instanceof Date) && !Array.isArray(v) && ("increment" in v || "decrement" in v)) {
      row[k] += (v.increment ?? 0) - (v.decrement ?? 0);
    } else row[k] = v;
  }
}

/** Base de datos en memoria con la semántica que usan los servicios (updateMany condicional, rollback en $transaction). */
export function createFakeDb() {
  let seq = 0;
  const state = { category: [] as Row[], product: [] as Row[], productVariant: [] as Row[], order: [] as Row[], orderItem: [] as Row[], payment: [] as Row[] };
  type Table = keyof typeof state;
  const id = (p: string) => `${p}_${++seq}`;

  const model = (name: Table, opts: { onCreate?: (row: Row, data: Row) => void; decorate?: (row: Row, args: Row) => Row } = {}) => {
    const rows = () => state[name];
    const out = (r: Row, args: Row = {}) => (opts.decorate ? opts.decorate(r, args) : r);
    const api: Record<string, (args?: any) => Promise<any>> = {
      findMany: async (a = {}) => rows().filter((r) => matches(r, a.where)).map((r) => out(r, a)),
      findFirst: async (a = {}) => { const r = rows().find((x) => matches(x, a.where)); return r ? out(r, a) : null; },
      findUnique: async (a) => { const r = rows().find((x) => matches(x, a.where)); return r ? out(r, a) : null; },
      findUniqueOrThrow: async (a) => { const r = await api.findUnique(a); if (!r) throw new Error("NotFound"); return r; },
      count: async (a = {}) => rows().filter((r) => matches(r, a.where)).length,
      updateMany: async (a) => { const hit = rows().filter((r) => matches(r, a.where)); hit.forEach((r) => applyData(r, a.data)); return { count: hit.length }; },
      update: async (a) => { const r = rows().find((x) => matches(x, a.where)); if (!r) throw new Error("NotFound"); applyData(r, a.data); return out(r, a); },
      delete: async (a) => { const i = rows().findIndex((x) => matches(x, a.where)); if (i < 0) throw new Error("NotFound"); const [r] = rows().splice(i, 1); return r; },
      create: async (a) => { const row: Row = { id: id(name), createdAt: new Date(), ...a.data }; delete row.items; delete row.variants; rows().push(row); opts.onCreate?.(row, a.data); return out(row, a); },
      upsert: async (a) => { const r = rows().find((x) => matches(x, a.where)); if (r) { applyData(r, a.update); return out(r, a); } return api.create({ data: a.create }); },
      aggregate: async (a) => ({ _sum: { stock: rows().filter((r) => matches(r, a.where)).reduce((n, r) => n + r.stock, 0) } }),
    };
    return api;
  };

  const tx: Record<string, any> = {
    category: model("category"),
    product: model("product", {
      onCreate: (row, data) => { for (const v of data.variants?.create ?? []) state.productVariant.push({ id: id("variant"), productId: row.id, ...v }); },
      decorate: (r, args) => {
        if (!args.include?.variants) return r;
        const variants = state.productVariant.filter((v) => v.productId === r.id).map((v) => ({ ...v, _count: { orderItems: state.orderItem.filter((i) => i.variantId === v.id).length } }));
        return { ...r, variants };
      },
    }),
    productVariant: model("productVariant"),
    order: model("order", { onCreate: (row, data) => { for (const it of data.items?.create ?? []) state.orderItem.push({ id: id("item"), orderId: row.id, ...it }); } }),
    orderItem: model("orderItem"),
    payment: model("payment"),
  };
  // `product.delete` en Prisma cascada a variantes
  const origDelete = tx.product.delete;
  tx.product.delete = async (a: any) => { const r = await origDelete(a); state.productVariant = state.productVariant.filter((v) => v.productId !== r.id); return r; };

  const db = {
    ...tx,
    $transaction: async (fn: (t: typeof tx) => Promise<unknown>) => {
      const snapshot = structuredClone(state);
      try { return await fn(tx); } catch (e) { (Object.keys(snapshot) as Table[]).forEach((k) => { state[k].splice(0, state[k].length, ...snapshot[k]); }); throw e; }
    },
  };

  const seed = {
    category: (slug = "calzado") => { const r = { id: `cat_${slug}`, slug, label: slug }; state.category.push(r); return r; },
    product: (over: Row = {}) => { const r = { id: id("prod"), slug: `p-${seq}`, name: `Producto ${seq}`, brand: "Marca", description: "d", priceCOP: 100_000, sizes: [], stock: 0, active: true, images: ["https://images.unsplash.com/x"], tags: [], featured: false, gender: "UNISEX", isAccessory: false, categoryId: "cat_calzado", createdAt: new Date(), ...over }; state.product.push(r); return r; },
    variant: (productId: string, size: string, stock: number) => { const r = { id: id("variant"), productId, size, stock }; state.productVariant.push(r); return r; },
    order: (over: Row = {}) => { const r = { id: id("ord"), publicCode: `7H-TEST-${seq}`, status: "PENDING_PAYMENT", paymentMethod: "CARD", totalCOP: 100_000, expiresAt: new Date(Date.now() + 3600_000), createdAt: new Date(), ...over }; state.order.push(r); return r; },
    item: (orderId: string, productId: string, quantity: number, variantId: string | null = null, size?: string) => { const r = { id: id("item"), orderId, productId, variantId, name: "x", size, unitPriceCOP: 100_000, quantity }; state.orderItem.push(r); return r; },
    payment: (over: Row) => { const r = { id: id("pay"), createdAt: new Date(), provider: "manual", ...over }; state.payment.push(r); return r; },
  };

  return { db: db as unknown as PrismaClient, state, seed };
}

export const checkoutBase = {
  customer: { fullName: "Ana Pérez", email: "ana@example.com", phone: "3001234567", documentType: "CC" as const, documentNumber: "12345678" },
  shipping: { department: "Meta", city: "Villavicencio", address: "Calle 1 # 2-3" },
  paymentMethod: "card" as const,
  terms: true as const,
};
