import { NextResponse } from "next/server";
import { z } from "zod";
import { consumeToken, createCustomerSession, setCustomerCookie, signInVerifiedEmail } from "@/lib/customer/auth";
import { body, emailField, fail, limit } from "@/lib/customer/http";
import { isSameOrigin } from "@/lib/request";

const schema = z.object({ email: emailField, code: z.string().trim().regex(/^\d{6}$/, "El código tiene 6 dígitos") });

export async function POST(req: Request) {
  if (!isSameOrigin(req)) return NextResponse.json({ error: "Origen no permitido" }, { status: 403 });
  const b = await body(req, schema);
  if ("error" in b) return b.error;
  const limited = await limit(req, "c-otp-verify", b.data.email, 30, 10, 30);
  if (limited) return limited;
  try {
    if (!(await consumeToken(b.data.email, "otp", b.data.code))) {
      return NextResponse.json({ error: "Código incorrecto o vencido. Pide uno nuevo." }, { status: 400 });
    }
    const customer = await signInVerifiedEmail({ email: b.data.email, provider: "email_otp", providerUserId: b.data.email });
    const res = NextResponse.json({ ok: true });
    setCustomerCookie(res, await createCustomerSession(customer.id, req));
    return res;
  } catch (e) {
    return fail(e);
  }
}
