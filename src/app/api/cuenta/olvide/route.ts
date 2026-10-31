import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { issueToken } from "@/lib/customer/auth";
import { resetEmail } from "@/lib/customer/emails";
import { body, emailField, fail, limit } from "@/lib/customer/http";
import { isSameOrigin } from "@/lib/request";

const MSG = "Si existe una cuenta con ese correo, te enviamos un enlace para crear una nueva contraseña.";

/** Respuesta siempre igual (no revela si el correo tiene cuenta). */
export async function POST(req: Request) {
  if (!isSameOrigin(req)) return NextResponse.json({ error: "Origen no permitido" }, { status: 403 });
  const b = await body(req, z.object({ email: emailField }));
  if ("error" in b) return b.error;
  const limited = await limit(req, "c-forgot", b.data.email, 10, 3, 60);
  if (limited) return limited;
  try {
    const c = await prisma.customer.findUnique({ where: { email: b.data.email } });
    if (c && !c.blockedAt) await resetEmail(c.email, await issueToken(c.email, "reset"));
    return NextResponse.json({ ok: true, message: MSG });
  } catch (e) {
    return fail(e);
  }
}
