import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentCustomer } from "@/lib/customer/auth";
import { canAccess } from "@/lib/services/special-requests";
import type { Product } from "@/types";

/**
 * Datos del producto privado de una oferta vigente, para agregarlo al carrito. El precio que se cobra lo vuelve
 * a leer el servidor en el checkout (y allí se exige el correo dueño de la oferta): esto es solo para mostrarlo.
 */
export async function GET(req: Request, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const token = new URL(req.url).searchParams.get("t");
  const r = await prisma.productRequest.findUnique({ where: { code: code.slice(0, 30) }, select: { id: true, email: true, customerId: true } });
  const customer = await getCurrentCustomer().catch(() => null);
  if (!r || !(await canAccess(r, { customer, token }))) return NextResponse.json({ error: "No encontrado." }, { status: 404 });
  const offer = await prisma.customOffer.findFirst({
    where: { requestId: r.id, status: "ACTIVA", expiresAt: { gt: new Date() } },
    include: { product: { include: { category: { select: { slug: true } } } } },
  });
  if (!offer || !offer.product.active) return NextResponse.json({ error: "No hay una oferta vigente." }, { status: 404 });
  const p = offer.product;
  const product: Product = {
    id: p.id, slug: p.slug, name: p.name, brand: p.brand, description: p.description, priceCOP: p.priceCOP, category: p.category.slug,
    gender: "unisex", isAccessory: false, images: p.images, stock: p.stock, tags: [], weightGrams: p.weightGrams ?? null,
  };
  return NextResponse.json({ product, email: offer.customerEmail, expiresAt: offer.expiresAt.toISOString() });
}
