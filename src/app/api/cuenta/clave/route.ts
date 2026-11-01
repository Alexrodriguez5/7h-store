import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { hashPassword, passwordPolicyError, sha256Hex, verifyPassword } from "@/lib/admin/password";
import { CUSTOMER_COOKIE, requireCustomer, revokeCustomerSessions } from "@/lib/customer/auth";
import { body, fail, limit } from "@/lib/customer/http";
import { readCookieValue } from "@/lib/request";

const schema = z.object({ current: z.string().max(200).optional(), password: z.string().max(200) });

/** Crear o cambiar contraseña. Si ya tiene una, exige la actual. Cierra las demás sesiones. */
export async function POST(req: Request) {
  const auth = await requireCustomer(req, { verified: true });
  if ("error" in auth) return auth.error;
  const b = await body(req, schema);
  if ("error" in b) return b.error;
  const c = auth.customer;
  const limited = await limit(req, "c-pass", c.email, 20, 6, 30);
  if (limited) return limited;
  const policy = passwordPolicyError(b.data.password, c.email);
  if (policy) return NextResponse.json({ error: policy }, { status: 400 });
  try {
    if (c.passwordHash && !(await verifyPassword(b.data.current ?? "", c.passwordHash))) {
      return NextResponse.json({ error: "La contraseña actual no es correcta." }, { status: 400 });
    }
    await prisma.customer.update({ where: { id: c.id }, data: { passwordHash: await hashPassword(b.data.password) } });
    await prisma.customerIdentity.upsert({
      where: { provider_providerUserId: { provider: "password", providerUserId: c.email } },
      update: {},
      create: { customerId: c.id, provider: "password", providerUserId: c.email },
    });
    const token = readCookieValue(req, CUSTOMER_COOKIE);
    await revokeCustomerSessions(c.id, token ? sha256Hex(token) : undefined);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return fail(e);
  }
}
