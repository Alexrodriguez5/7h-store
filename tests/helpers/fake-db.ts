/* eslint-disable @typescript-eslint/no-explicit-any */
import type { PrismaClient } from "@prisma/client";

type Row = Record<string, any>;

function matches(row: Row, where: Row | undefined): boolean {
  for (const [k, cond] of Object.entries(where ?? {})) {
    if (k === "OR") { if (!(cond as Row[]).some((w) => matches(row, w))) return false; continue; }
    if (k === "AND") { if (!(cond as Row[]).every((w) => matches(row, w))) return false; continue; }
    if (k === "productId_size") { if (row.productId !== cond.productId || row.size !== cond.size) return false; continue; }
    if (k === "provider_providerUserId") { if (row.provider !== cond.provider || row.providerUserId !== cond.providerUserId) return false; continue; }
    const val = row[k];
    if (cond === null) { if (val !== null && val !== undefined) return false; continue; }
    if (cond && typeof cond === "object" && !(cond instanceof Date)) {
      if ("in" in cond && !cond.in.includes(val)) return false;
      if ("gte" in cond && !(val >= cond.gte)) return false;
      if ("gt" in cond && !(val > cond.gt)) return false;
      if ("lt" in cond && !(val < cond.lt)) return false;
      if ("not" in cond && (cond.not === null ? val === null || val === undefined : val === cond.not)) return false;
      if ("equals" in cond && String(val).toLowerCase() !== String(cond.equals).toLowerCase()) return false;
      if ("has" in cond && !(Array.isArray(val) && val.includes(cond.has))) return false;
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
  const state = {
    category: [] as Row[], product: [] as Row[], productVariant: [] as Row[], order: [] as Row[], orderItem: [] as Row[], payment: [] as Row[],
    adminUser: [] as Row[], adminSession: [] as Row[], adminPasswordReset: [] as Row[], adminAuditLog: [] as Row[], rateLimit: [] as Row[],
    customer: [] as Row[], customerIdentity: [] as Row[], customerSession: [] as Row[], customerToken: [] as Row[], customerAddress: [] as Row[],
    supportRequest: [] as Row[], supportRequestItem: [] as Row[], supportAttachment: [] as Row[], supportEvent: [] as Row[], counter: [] as Row[], emailLog: [] as Row[],
  };
  type Table = keyof typeof state;
  const id = (p: string) => `${p}_${++seq}`;
  /** Registro de operaciones (para medir cuántas consultas hace cada acción). */
  const ops: string[] = [];
  const unique: Partial<Record<Table, string[]>> = { category: ["slug"], product: ["slug"], adminUser: ["email"], adminSession: ["tokenHash"], adminPasswordReset: ["tokenHash"], customer: ["email"], customerSession: ["tokenHash"], supportRequest: ["code"], counter: ["key"] };
  const defaults: Partial<Record<Table, Row>> = {
    category: { active: true, sortOrder: 0, imageUrl: null },
    adminUser: { role: "ADMIN", active: true, lastLoginAt: null, passwordChangedAt: new Date(0) },
    adminSession: { revokedAt: null },
    adminPasswordReset: { usedAt: null },
    customer: { emailVerifiedAt: null, passwordHash: null, blockedAt: null, avatarUrl: null, phone: null, deletionRequestedAt: null },
    customerSession: { revokedAt: null },
    customerToken: { usedAt: null, attempts: 0 },
    supportRequest: { status: "RECIBIDA", assignedAdminId: null, resolution: null, refundAmountCOP: null, refundReference: null },
  };

  const model = (name: Table, opts: { onCreate?: (row: Row, data: Row) => void; decorate?: (row: Row, args: Row) => Row } = {}) => {
    const rows = () => state[name];
    const out = (r: Row, args: Row = {}) => (opts.decorate ? opts.decorate(r, args) : r);
    const checkUnique = (row: Row, self?: Row) => {
      for (const f of unique[name] ?? []) if (rows().some((x) => x !== self && x[f] === row[f])) { const e: any = new Error(`Unique constraint failed on ${f}`); e.code = "P2002"; throw e; }
    };
    const api: Record<string, (args?: any) => Promise<any>> = {
      findMany: async (a = {}) => {
        let list = rows().filter((r) => matches(r, a.where));
        const ob = Array.isArray(a.orderBy) ? a.orderBy[0] : a.orderBy;
        if (ob) { const [[k, dir]] = Object.entries(ob) as [string, string][]; list = [...list].sort((x, y) => (x[k] > y[k] ? 1 : x[k] < y[k] ? -1 : 0) * (dir === "desc" ? -1 : 1)); }
        if (a.skip) list = list.slice(a.skip);
        if (a.take) list = list.slice(0, a.take);
        return list.map((r) => out(r, a));
      },
      findFirst: async (a = {}) => { const [r] = await api.findMany({ ...a, take: 1 }); return r ?? null; },
      findUnique: async (a) => { const r = rows().find((x) => matches(x, a.where)); return r ? out(r, a) : null; },
      findUniqueOrThrow: async (a) => { const r = await api.findUnique(a); if (!r) throw new Error("NotFound"); return r; },
      count: async (a = {}) => rows().filter((r) => matches(r, a.where)).length,
      updateMany: async (a) => { const hit = rows().filter((r) => matches(r, a.where)); hit.forEach((r) => applyData(r, a.data)); return { count: hit.length }; },
      update: async (a) => { const r = rows().find((x) => matches(x, a.where)); if (!r) throw new Error("NotFound"); const next = { ...r }; applyData(next, a.data); checkUnique(next, r); applyData(r, a.data); return out(r, a); },
      delete: async (a) => { const i = rows().findIndex((x) => matches(x, a.where)); if (i < 0) throw new Error("NotFound"); const [r] = rows().splice(i, 1); return r; },
      deleteMany: async (a = {}) => { const keep = rows().filter((r) => !matches(r, a.where)); const n = rows().length - keep.length; rows().splice(0, rows().length, ...keep); return { count: n }; },
      create: async (a) => { const row: Row = { id: id(name), createdAt: new Date(), ...defaults[name], ...a.data }; delete row.items; delete row.variants; delete row.attachments; delete row.events; checkUnique(row); rows().push(row); opts.onCreate?.(row, a.data); return out(row, a); },
      createMany: async (a) => { for (const d of a.data) await api.create({ data: d }); return { count: a.data.length }; },
      upsert: async (a) => { const r = rows().find((x) => matches(x, a.where)); if (r) { applyData(r, a.update); return out(r, a); } return api.create({ data: a.create }); },
      aggregate: async (a) => ({ _sum: { stock: rows().filter((r) => matches(r, a.where)).reduce((n, r) => n + r.stock, 0) } }),
      groupBy: async (a) => {
        const [by] = a.by as string[];
        const groups = new Map<unknown, number>();
        for (const r of rows().filter((x) => matches(x, a.where))) groups.set(r[by], (groups.get(r[by]) ?? 0) + 1);
        return [...groups].map(([k, n]) => ({ [by]: k, _count: { _all: n } }));
      },
    };
    // Cuenta cada llamada EXTERNA como una operación de base de datos (las llamadas internas entre métodos no cuentan).
    const raw = { ...api };
    const counted: Record<string, (args?: any) => Promise<any>> = {};
    for (const [k, fn] of Object.entries(raw)) counted[k] = (args?: any) => { ops.push(`${name}.${k}`); return fn(args); };
    return counted;
  };

  const withVariants = (r: Row, args: Row) => {
    const wantVariants = args.include?.variants || args.select?.variants;
    const wantCategory = args.include?.category || args.select?.category;
    if (!wantVariants && !wantCategory) return r;
    const extra: Row = {};
    if (wantVariants) extra.variants = state.productVariant.filter((v) => v.productId === r.id).map((v) => ({ ...v, _count: { orderItems: state.orderItem.filter((i) => i.variantId === v.id).length } }));
    if (wantCategory) extra.category = state.category.find((c) => c.id === r.categoryId) ?? null;
    return { ...r, ...extra };
  };
  const withAdmin = (r: Row, args: Row) => (args.include?.admin || args.select?.admin ? { ...r, admin: state.adminUser.find((u) => u.id === r.adminId) } : r);

  const tx: Record<string, any> = {
    category: model("category", {
      decorate: (r, args) => (args.include?._count ? { ...r, _count: { products: state.product.filter((p) => p.categoryId === r.id).length } } : r),
    }),
    product: model("product", {
      onCreate: (row, data) => { for (const v of data.variants?.create ?? []) state.productVariant.push({ id: id("variant"), productId: row.id, ...v }); },
      decorate: withVariants,
    }),
    productVariant: model("productVariant"),
    order: model("order", {
      onCreate: (row, data) => { for (const it of data.items?.create ?? []) state.orderItem.push({ id: id("item"), orderId: row.id, ...it }); },
      // Las filas sembradas pueden traer `items`; si no, se resuelven desde orderItem.
      decorate: (r, args) => (args.include?.items && !r.items ? { ...r, items: state.orderItem.filter((i) => i.orderId === r.id), payments: state.payment.filter((p) => p.orderId === r.id) } : r),
    }),
    orderItem: model("orderItem"),
    payment: model("payment"),
    adminUser: model("adminUser"),
    adminSession: model("adminSession", { decorate: withAdmin }),
    adminPasswordReset: model("adminPasswordReset", { decorate: withAdmin }),
    adminAuditLog: model("adminAuditLog"),
    rateLimit: model("rateLimit"),
    customer: model("customer"),
    customerIdentity: model("customerIdentity"),
    customerSession: model("customerSession", { decorate: (r, args) => (args.include?.customer ? { ...r, customer: state.customer.find((c) => c.id === r.customerId) } : r) }),
    customerToken: model("customerToken"),
    customerAddress: model("customerAddress"),
    supportRequest: model("supportRequest", {
      onCreate: (row, data) => {
        for (const it of data.items?.create ?? []) state.supportRequestItem.push({ id: id("sri"), requestId: row.id, ...it });
        for (const a of data.attachments?.create ?? []) state.supportAttachment.push({ id: id("att"), requestId: row.id, createdAt: new Date(), ...a });
        const evs = data.events?.create ? (Array.isArray(data.events.create) ? data.events.create : [data.events.create]) : [];
        for (const e of evs) state.supportEvent.push({ id: id("evt"), requestId: row.id, createdAt: new Date(), visibleToCustomer: true, ...e });
      },
      decorate: (r, args) => {
        const inc = args.include ?? {};
        return {
          ...r,
          ...(inc.customer ? { customer: state.customer.find((c) => c.id === r.customerId) } : {}),
          ...(inc.order ? { order: state.order.find((o) => o.id === r.orderId) } : {}),
        };
      },
    }),
    supportRequestItem: model("supportRequestItem"),
    supportAttachment: model("supportAttachment"),
    supportEvent: model("supportEvent"),
    counter: model("counter"),
    emailLog: model("emailLog"),
  };
  // `product.delete` en Prisma cascada a variantes
  const origDelete = tx.product.delete;
  tx.product.delete = async (a: any) => { const r = await origDelete(a); state.productVariant = state.productVariant.filter((v) => v.productId !== r.id); return r; };

  const db = {
    ...tx,
    $transaction: async (fnOrOps: ((t: typeof tx) => Promise<unknown>) | Promise<unknown>[]) => {
      ops.push("$transaction");
      const snapshot = structuredClone(state);
      try {
        if (Array.isArray(fnOrOps)) { const out = []; for (const p of fnOrOps) out.push(await p); return out; }
        return await fnOrOps(tx);
      } catch (e) {
        (Object.keys(snapshot) as Table[]).forEach((k) => { state[k].splice(0, state[k].length, ...snapshot[k]); });
        throw e;
      }
    },
  };

  const seed = {
    category: (slug = "calzado", over: Row = {}) => { const r = { id: `cat_${slug}`, slug, label: slug, active: true, sortOrder: 0, imageUrl: null, ...over }; state.category.push(r); return r; },
    product: (over: Row = {}) => { const r = { id: id("prod"), slug: `p-${seq}`, name: `Producto ${seq}`, brand: "Marca", description: "d", priceCOP: 100_000, sizes: [], stock: 0, active: true, images: ["https://images.unsplash.com/x"], tags: [], featured: false, gender: "UNISEX", isAccessory: false, categoryId: "cat_calzado", createdAt: new Date(), ...over }; state.product.push(r); return r; },
    variant: (productId: string, size: string, stock: number) => { const r = { id: id("variant"), productId, size, stock }; state.productVariant.push(r); return r; },
    order: (over: Row = {}) => { const r = { id: id("ord"), publicCode: `7H-TEST-${seq}`, status: "PENDING_PAYMENT", paymentMethod: "CARD", totalCOP: 100_000, expiresAt: new Date(Date.now() + 3600_000), createdAt: new Date(), ...over }; state.order.push(r); return r; },
    item: (orderId: string, productId: string, quantity: number, variantId: string | null = null, size?: string) => { const r = { id: id("item"), orderId, productId, variantId, name: "x", size, unitPriceCOP: 100_000, quantity }; state.orderItem.push(r); return r; },
    payment: (over: Row) => { const r = { id: id("pay"), createdAt: new Date(), provider: "manual", ...over }; state.payment.push(r); return r; },
  };

  return { db: db as unknown as PrismaClient, state, seed, ops, resetOps: () => { ops.length = 0; } };
}

export const checkoutBase = {
  customer: { fullName: "Ana Pérez", email: "ana@example.com", phone: "3001234567", documentType: "CC" as const, documentNumber: "12345678" },
  shipping: { department: "Meta", city: "Villavicencio", address: "Calle 1 # 2-3" },
  paymentMethod: "card" as const,
  terms: true as const,
};
