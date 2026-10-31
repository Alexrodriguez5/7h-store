import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { dummyHash, verifyPassword } from "@/lib/admin/password";
import { createCustomerSession, issueToken, setCustomerCookie } from "@/lib/customer/auth";
import { verifyEmail } from "@/lib/customer/emails";
import { body, emailField, fail, limit, passwordField } from "@/lib/customer/http";
import { isSameOrigin } from "@/lib/request";

const schema = z.object({ email: emailField, password: passwordField });
const WRONG = "Correo o contraseña incorrectos.";

export async function POST(req: Request) {
  if (!isSameOrigin(req)) return NextResponse.json({ error: "Origen no permitido" }, { status: 403 });
  const b = await body(req, schema);
  if ("error" in b) return b.error;
  const { email, password } = b.data;
  const limited = await limit(req, "c-login", email, 30, 6, 15);
  if (limited) return limited;
  try {
    const c = await prisma.customer.findUnique({ where: { email } });
    // Mismo tiempo de respuesta exista o no la cuenta.
    const ok = await verifyPassword(password, c?.passwordHash ?? (await dummyHash()));
    if (!c || !c.passwordHash || !ok) return NextResponse.json({ error: WRONG }, { status: 401 });
    if (c.blockedAt) return NextResponse.json({ error: "Esta cuenta está bloqueada. Escríbenos para ayudarte." }, { status: 403 });
    if (!c.emailVerifiedAt) {
      await verifyEmail(email, c.name.split(" ")[0], await issueToken(email, "verify"));
      return NextResponse.json({ error: "Confirma tu correo para entrar: te enviamos un nuevo enlace.", code: "unverified" }, { status: 403 });
    }
    const res = NextResponse.json({ ok: true });
    setCustomerCookie(res, await createCustomerSession(c.id, req));
    return res;
  } catch (e) {
    return fail(e);
  }
}
