import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { CUSTOMER_COOKIE, clearCustomerCookie } from "@/lib/customer/auth";
import { sha256Hex } from "@/lib/admin/password";
import { isSameOrigin, readCookieValue } from "@/lib/request";

export async function POST(req: Request) {
  if (!isSameOrigin(req)) return NextResponse.json({ error: "Origen no permitido" }, { status: 403 });
  const token = readCookieValue(req, CUSTOMER_COOKIE);
  if (token) await prisma.customerSession.updateMany({ where: { tokenHash: sha256Hex(token), revokedAt: null }, data: { revokedAt: new Date() } });
  const res = NextResponse.json({ ok: true });
  clearCustomerCookie(res);
  return res;
}
