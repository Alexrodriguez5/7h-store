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
      include: { payments: { select: { status: true, createdAt: true } } },
    }),
  ]);
  return { total, pages: Math.max(1, Math.ceil(total / PAGE_SIZE)), orders };
}

export const getOrderDetail = (id: string) =>
  prisma.order.findUnique({ where: { id }, include: { items: { include: { product: { select: { slug: true } } } }, payments: { orderBy: { createdAt: "desc" } } } });

export async function listProductsAdmin() {
  const rows = await prisma.product.findMany({ include: { category: true, variants: true }, orderBy: { createdAt: "desc" } });
  return rows.map((p) => ({ ...p, variants: [...p.variants], totalStock: totalStock(p.variants, p.stock) }));
}

export async function getDashboard() {
  const [byStatus, sales, products, recent, lateApprovals] = await Promise.all([
    prisma.order.groupBy({ by: ["status"], _count: { _all: true } }),
    prisma.order.aggregate({ where: { status: { in: REVENUE_STATUSES } }, _sum: { totalCOP: true } }),
    prisma.product.findMany({ select: { id: true, name: true, slug: true, active: true, stock: true, variants: { select: { size: true, stock: true } } } }),
    prisma.order.findMany({ orderBy: { createdAt: "desc" }, take: 6, include: { payments: { select: { status: true, createdAt: true } } } }),
    // Pagos aprobados en pedidos ya expirados/cancelados: requieren atención manual (reembolso o reactivación).
    prisma.order.findMany({ where: { status: { in: ["EXPIRED", "CANCELLED"] }, payments: { some: { status: "APPROVED" } } }, select: { id: true, publicCode: true } }),
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
    activeProducts: active.length,
    soldOut: withTotals.filter((p) => p.total === 0),
    lowStock: withTotals.filter((p) => p.total > 0 && (p.total <= LOW_STOCK_THRESHOLD || p.variants.some((v) => v.stock > 0 && v.stock <= 1))),
    recent,
    lateApprovals,
  };
}
