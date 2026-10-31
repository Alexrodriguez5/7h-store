import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { hashPassword, passwordPolicyError } from "@/lib/admin/password";
import { consumeToken, createCustomerSession, revokeCustomerSessions, setCustomerCookie } from "@/lib/customer/auth";
import { body, emailField, fail, limit } from "@/lib/customer/http";
import { isSameOrigin } from "@/lib/request";

const schema = z.object({ email: emailField, token: z.string().min(10).max(100), password: z.string().max(200) });

/** Nueva contraseña con el enlace del correo. El enlace demuestra el correo: la cuenta queda verificada y se cierran las demás sesiones. */
export async function POST(req: Request) {
  if (!isSameOrigin(req)) return NextResponse.json({ error: "Origen no permitido" }, { status: 403 });
  const b = await body(req, schema);
  if ("error" in b) return b.error;
  const { email, token, password } = b.data;
  const policy = passwordPolicyError(password, email);
  if (policy) return NextResponse.json({ error: policy }, { status: 400 });
  const limited = await limit(req, "c-reset", email, 20, 8, 60);
  if (limited) return limited;
  try {
    const c = await prisma.customer.findUnique({ where: { email } });
    if (!c || c.blockedAt || !(await consumeToken(email, "reset", token))) {
      return NextResponse.json({ error: "El enlace no es válido o ya venció. Pide uno nuevo." }, { status: 400 });
    }
    await prisma.customer.update({ where: { id: c.id }, data: { passwordHash: await hashPassword(password), emailVerifiedAt: c.emailVerifiedAt ?? new Date() } });
    await prisma.customerIdentity.upsert({
      where: { provider_providerUserId: { provider: "password", providerUserId: email } },
      update: { customerId: c.id },
      create: { customerId: c.id, provider: "password", providerUserId: email },
    });
    await revokeCustomerSessions(c.id);
    const res = NextResponse.json({ ok: true });
    setCustomerCookie(res, await createCustomerSession(c.id, req));
    return res;
  } catch (e) {
    return fail(e);
  }
}
