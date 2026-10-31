import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { hashPassword, passwordPolicyError } from "@/lib/admin/password";
import { issueToken } from "@/lib/customer/auth";
import { alreadyRegisteredEmail, verifyEmail } from "@/lib/customer/emails";
import { body, emailField, fail, limit } from "@/lib/customer/http";
import { isSameOrigin } from "@/lib/request";

const schema = z.object({ name: z.string().trim().min(3, "Escribe tu nombre completo").max(120), email: emailField, password: z.string().max(200) });
const DONE = "Si el correo es válido, te enviamos un enlace para confirmarlo. Revisa tu bandeja (y la de spam).";

/** Registro con correo y contraseña. La cuenta queda sin verificar hasta abrir el enlace del correo. Respuesta genérica (no revela si el correo existe). */
export async function POST(req: Request) {
  if (!isSameOrigin(req)) return NextResponse.json({ error: "Origen no permitido" }, { status: 403 });
  const b = await body(req, schema);
  if ("error" in b) return b.error;
  const { name, email, password } = b.data;
  const policy = passwordPolicyError(password, email);
  if (policy) return NextResponse.json({ error: policy }, { status: 400 });
  const limited = await limit(req, "c-register", email, 10, 3, 60);
  if (limited) return limited;
  try {
    const existing = await prisma.customer.findUnique({ where: { email } });
    if (existing?.emailVerifiedAt) {
      await alreadyRegisteredEmail(email);
      return NextResponse.json({ ok: true, message: DONE });
    }
    const passwordHash = await hashPassword(password);
    const customer = existing
      ? await prisma.customer.update({ where: { id: existing.id }, data: { name, passwordHash } })
      : await prisma.customer.create({ data: { email, name, passwordHash } });
    await prisma.customerIdentity.upsert({
      where: { provider_providerUserId: { provider: "password", providerUserId: email } },
      update: { customerId: customer.id },
      create: { customerId: customer.id, provider: "password", providerUserId: email },
    });
    const sent = await verifyEmail(email, name.split(" ")[0], await issueToken(email, "verify"));
    return NextResponse.json({
      ok: true,
      message: sent ? DONE : "Cuenta creada, pero el correo de confirmación aún no está disponible. Usa «Continuar con Google» o inténtalo más tarde.",
    });
  } catch (e) {
    return fail(e);
  }
}
