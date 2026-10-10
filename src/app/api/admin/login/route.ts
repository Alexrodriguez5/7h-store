import { NextResponse } from "next/server";
import { z } from "zod";
import { COOKIE_NAME, IS_PROD, SESSION_MAX_AGE, createSessionToken } from "@/lib/admin/session";
import { checkAdminPassword, clearFailures, isRateLimited, registerFailure } from "@/lib/admin/password";

const schema = z.object({ password: z.string().min(1).max(200) });

export async function POST(req: Request) {
  if (!process.env.ADMIN_PASSWORD) {
    return NextResponse.json({ error: "El acceso administrativo no está configurado." }, { status: 503 });
  }
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  if (isRateLimited(ip)) {
    return NextResponse.json({ error: "Demasiados intentos. Espera 15 minutos." }, { status: 429 });
  }
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success || !checkAdminPassword(parsed.data.password)) {
    registerFailure(ip);
    return NextResponse.json({ error: "Contraseña incorrecta." }, { status: 401 });
  }
  clearFailures(ip);
  const res = NextResponse.json({ ok: true });
  res.cookies.set(COOKIE_NAME, await createSessionToken(), {
    httpOnly: true,
    secure: IS_PROD,
    sameSite: "strict",
    path: "/",
    maxAge: SESSION_MAX_AGE,
  });
  return res;
}
