import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { consumeToken, createCustomerSession, normalizeEmail, setCustomerCookie } from "@/lib/customer/auth";
import { welcomeEmail } from "@/lib/customer/emails";
import { limit } from "@/lib/customer/http";

/** Enlace del correo de confirmación: marca el correo como verificado e inicia sesión. */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const email = normalizeEmail(url.searchParams.get("email") ?? "");
  const token = url.searchParams.get("token") ?? "";
  const invalid = () => NextResponse.redirect(new URL("/cuenta?aviso=enlace-invalido", url));
  const limited = await limit(req, "c-verify", null, 30, 0, 60);
  if (limited || !email || !token || token.length > 100) return invalid();
  if (!(await consumeToken(email, "verify", token))) return invalid();
  const customer = await prisma.customer.findUnique({ where: { email } });
  if (!customer || customer.blockedAt) return invalid();
  if (!customer.emailVerifiedAt) {
    await prisma.customer.update({ where: { id: customer.id }, data: { emailVerifiedAt: new Date() } });
    await welcomeEmail(email, customer.name.split(" ")[0]);
  }
  const res = NextResponse.redirect(new URL("/cuenta/pedidos?bienvenida=1", url));
  setCustomerCookie(res, await createCustomerSession(customer.id, req));
  return res;
}
