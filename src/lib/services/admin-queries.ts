import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { REVENUE_STATUSES } from "@/lib/order-status";
import { totalStock } from "@/lib/sizes";

export const PAGE_SIZE = 20;
export const LOW_STOCK_THRESHOLD = 3;

export interface OrderFilters { q?: string; status?: Prisma.OrderWhereInput["status"]; method?: Prisma.OrderWhereInput["paymentMethod"]; from?: string; to?: string; page: number }

export function buildOrderWhere(f: Omit<OrderFilters, "page">): Prisma.OrderWhereInput {
  const where: Prisma.OrderWhereInput = {};
  if (f.status) where.status = f.status;
  if (f.method) where.paymentMethod = f.method;
  if (f.from || f.to) {
    where.createdAt = {
      ...(f.from ? { gte: new Date(`${f.from}T00:00:00-05:00`) } : {}), // hora de Colombia
      ...(f.to ? { lte: new Date(`${f.to}T23:59:59.999-05:00`) } : {}),
    };
  }
  if (f.q) {
    where.OR = [
      { publicCode: { contains: f.q, mode: "insensitive" } },
      { customerFullName: { contains: f.q, mode: "insensitive" } },
      { customerEmail: { contains: f.q, mode: "insensitive" } },
    ];
  }
  return where;
}

export async function listOrders(f: OrderFilters) {
  const where = buildOrderWhere(f);
  const [total, orders] = await Promise.all([
    prisma.order.count({ where }),
    prisma.order.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (f.page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      select: {
        id: true, publicCode: true, createdAt: true, customerFullName: true, customerEmail: true, city: true, totalCOP: true, paymentMethod: true, status: true,
        payments: { select: { status: true, createdAt: true } },
      },
    }),
  ]);
  return { total, pages: Math.max(1, Math.ceil(total / PAGE_SIZE)), orders };
}

export const getOrderDetail = (id: string) =>
  prisma.order.findUnique({ where: { id }, include: { items: { include: { product: { select: { slug: true } } } }, payments: { orderBy: { createdAt: "desc" } } } });

/** Solo los campos que muestran las tablas del panel (sin descripciones ni etiquetas). */
export async function listProductsAdmin() {
  const rows = await prisma.product.findMany({
    select: {
      id: true, slug: true, name: true, brand: true, priceCOP: true, images: true, stock: true, featured: true, active: true,
      category: { select: { label: true, active: true } },
      variants: { select: { id: true, size: true, stock: true } },
    },
    orderBy: { createdAt: "desc" },
  });
  return rows.map((p) => ({ ...p, variants: [...p.variants], totalStock: totalStock(p.variants, p.stock) }));
}

export async function getDashboard() {
  const since30 = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const [byStatus, sales, sales30, products, recent, lateApprovals, proofsToReview] = await Promise.all([
    prisma.order.groupBy({ by: ["status"], _count: { _all: true } }),
    prisma.order.aggregate({ where: { status: { in: REVENUE_STATUSES } }, _sum: { totalCOP: true }, _count: { _all: true } }),
    // Ventas confirmadas de los últimos 30 días (datos reales, sin estimaciones).
    prisma.order.aggregate({ where: { status: { in: REVENUE_STATUSES }, createdAt: { gte: since30 } }, _sum: { totalCOP: true }, _count: { _all: true } }),
    prisma.product.findMany({ select: { id: true, name: true, slug: true, active: true, stock: true, variants: { select: { size: true, stock: true } } } }),
    prisma.order.findMany({
      orderBy: { createdAt: "desc" },
      take: 6,
      select: { id: true, publicCode: true, createdAt: true, customerFullName: true, totalCOP: true, status: true, payments: { select: { status: true, createdAt: true } } },
    }),
    // Pagos aprobados en pedidos ya expirados/cancelados: requieren atención manual (reembolso o reactivación).
    prisma.order.findMany({ where: { status: { in: ["EXPIRED", "CANCELLED"] }, payments: { some: { status: "APPROVED" } } }, select: { id: true, publicCode: true } }),
    // Transferencias/consignaciones con comprobante subido y aún sin confirmar.
    prisma.order.findMany({
      where: { status: "PENDING_PAYMENT", paymentMethod: { in: ["BANK_TRANSFER", "CASH_DEPOSIT"] }, payments: { some: { proofUrl: { not: null }, status: "PENDING" } } },
      select: { id: true, publicCode: true, customerFullName: true, expiresAt: true },
      orderBy: { expiresAt: "asc" },
      take: 20,
    }),
  ]);
  const count = (s: string) => byStatus.find((g) => g.status === s)?._count._all ?? 0;
  const active = products.filter((p) => p.active);
  const withTotals = active.map((p) => ({ ...p, total: totalStock(p.variants, p.stock) }));
  return {
    totalOrders: byStatus.reduce((n, g) => n + g._count._all, 0),
    pending: count("PENDING_PAYMENT"),
    paid: count("PAID"),
    processing: count("PROCESSING"),
    shipped: count("SHIPPED"),
    delivered: count("DELIVERED"),
    salesCOP: sales._sum.totalCOP ?? 0,
    paidOrders: sales._count._all,
    avgTicketCOP: sales._count._all ? Math.round((sales._sum.totalCOP ?? 0) / sales._count._all) : 0,
    sales30COP: sales30._sum.totalCOP ?? 0,
    paidOrders30: sales30._count._all,
    activeProducts: active.length,
    soldOut: withTotals.filter((p) => p.total === 0),
    lowStock: withTotals.filter((p) => p.total > 0 && (p.total <= LOW_STOCK_THRESHOLD || p.variants.some((v) => v.stock > 0 && v.stock <= 1))),
    recent,
    lateApprovals,
    proofsToReview,
  };
}

/** Día calendario en Colombia (YYYY-MM-DD) para agrupar ventas por día. */
const bogotaDay = (d: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Bogota" }).format(d);

export interface SalesAnalytics {
  days: number;
  /** Ventas confirmadas por día (incluye días en cero). */
  daily: { day: string; totalCOP: number; orders: number }[];
  current: { salesCOP: number; orders: number; avgTicketCOP: number; createdOrders: number; units: number };
  previous: { salesCOP: number; orders: number; avgTicketCOP: number };
  /** % de pedidos creados en el periodo que llegaron a pago confirmado. */
  paidRate: number | null;
  byMethod: { method: string; salesCOP: number; orders: number }[];
  topProducts: { name: string; units: number; salesCOP: number }[];
  topDepartments: { department: string; salesCOP: number; orders: number }[];
  byStatus: { status: string; orders: number }[];
}

/**
 * Analítica del panel con datos reales: solo cuentan como venta los pedidos pagados, preparando, enviados o entregados.
 * Compara el periodo elegido con el periodo anterior de la misma duración.
 */
export async function getSalesAnalytics(days = 30): Promise<SalesAnalytics> {
  const now = new Date();
  const start = new Date(now.getTime() - days * 864e5);
  const prevStart = new Date(start.getTime() - days * 864e5);
  const orders = await prisma.order.findMany({
    where: { createdAt: { gte: prevStart } },
    select: { createdAt: true, status: true, totalCOP: true, paymentMethod: true, department: true, items: { select: { name: true, quantity: true, unitPriceCOP: true } } },
  });
  const isSale = (s: string) => (REVENUE_STATUSES as string[]).includes(s);
  const cur = orders.filter((o) => o.createdAt >= start);
  const prev = orders.filter((o) => o.createdAt < start);
  const curSales = cur.filter((o) => isSale(o.status));
  const prevSales = prev.filter((o) => isSale(o.status));
  const sum = (list: typeof orders) => list.reduce((n, o) => n + o.totalCOP, 0);

  const dailyMap = new Map<string, { totalCOP: number; orders: number }>();
  for (let i = days - 1; i >= 0; i--) dailyMap.set(bogotaDay(new Date(now.getTime() - i * 864e5)), { totalCOP: 0, orders: 0 });
  for (const o of curSales) {
    const k = bogotaDay(o.createdAt);
    const e = dailyMap.get(k);
    if (e) { e.totalCOP += o.totalCOP; e.orders += 1; }
  }

  const group = <K extends string>(list: typeof curSales, key: (o: (typeof curSales)[number]) => K) => {
    const m = new Map<K, { salesCOP: number; orders: number }>();
    for (const o of list) { const k = key(o); const e = m.get(k) ?? { salesCOP: 0, orders: 0 }; e.salesCOP += o.totalCOP; e.orders += 1; m.set(k, e); }
    return [...m].map(([k, v]) => ({ k, ...v })).sort((a, b) => b.salesCOP - a.salesCOP);
  };
  const products = new Map<string, { units: number; salesCOP: number }>();
  for (const o of curSales) for (const it of o.items) {
    const e = products.get(it.name) ?? { units: 0, salesCOP: 0 };
    e.units += it.quantity; e.salesCOP += it.quantity * it.unitPriceCOP; products.set(it.name, e);
  }
  const statusMap = new Map<string, number>();
  for (const o of cur) statusMap.set(o.status, (statusMap.get(o.status) ?? 0) + 1);
  const curTotal = sum(curSales);
  const prevTotal = sum(prevSales);
  const decided = cur.filter((o) => o.status !== "PENDING_PAYMENT");

  return {
    days,
    daily: [...dailyMap].map(([day, v]) => ({ day, ...v })),
    current: {
      salesCOP: curTotal, orders: curSales.length, avgTicketCOP: curSales.length ? Math.round(curTotal / curSales.length) : 0,
      createdOrders: cur.length, units: curSales.reduce((n, o) => n + o.items.reduce((m, i) => m + i.quantity, 0), 0),
    },
    previous: { salesCOP: prevTotal, orders: prevSales.length, avgTicketCOP: prevSales.length ? Math.round(prevTotal / prevSales.length) : 0 },
    paidRate: decided.length ? Math.round((curSales.length / decided.length) * 100) : null,
    byMethod: group(curSales, (o) => o.paymentMethod).map(({ k, ...v }) => ({ method: k, ...v })),
    topProducts: [...products].map(([name, v]) => ({ name, ...v })).sort((a, b) => b.salesCOP - a.salesCOP).slice(0, 6),
    topDepartments: group(curSales, (o) => o.department).slice(0, 6).map(({ k, ...v }) => ({ department: k, ...v })),
    byStatus: [...statusMap].map(([status, n]) => ({ status, orders: n })).sort((a, b) => b.orders - a.orders),
  };
}
