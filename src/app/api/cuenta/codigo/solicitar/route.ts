import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { issueToken } from "@/lib/customer/auth";
import { otpEmail } from "@/lib/customer/emails";
import { body, emailField, fail, limit } from "@/lib/customer/http";
import { isSameOrigin } from "@/lib/request";
import { isEmailConfigured } from "@/lib/email";

/** Envía un código de 6 dígitos al correo (sirve para entrar o crear la cuenta sin contraseña). */
export async function POST(req: Request) {
  if (!isSameOrigin(req)) return NextResponse.json({ error: "Origen no permitido" }, { status: 403 });
  if (!isEmailConfigured()) return NextResponse.json({ error: "El acceso con código estará disponible pronto. Usa «Continuar con Google»." }, { status: 503 });
  const b = await body(req, z.object({ email: emailField }));
  if ("error" in b) return b.error;
  const limited = await limit(req, "c-otp", b.data.email, 15, 4, 30);
  if (limited) return limited;
  try {
    const c = await prisma.customer.findUnique({ where: { email: b.data.email }, select: { blockedAt: true } });
    if (!c?.blockedAt) await otpEmail(b.data.email, await issueToken(b.data.email, "otp"));
    return NextResponse.json({ ok: true, message: "Te enviamos un código de 6 dígitos. Revisa tu correo." });
  } catch (e) {
    return fail(e);
  }
}
