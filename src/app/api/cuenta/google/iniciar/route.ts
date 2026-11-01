import { NextResponse } from "next/server";
import { GOOGLE_STATE_COOKIE, buildGoogleAuth, isGoogleConfigured } from "@/lib/customer/google";
import { limit } from "@/lib/customer/http";

export async function GET(req: Request) {
  const url = new URL(req.url);
  if (!isGoogleConfigured()) return NextResponse.redirect(new URL("/cuenta?aviso=google-no-disponible", url));
  const limited = await limit(req, "c-google", null, 30, 0, 10);
  if (limited) return NextResponse.redirect(new URL("/cuenta?aviso=demasiados-intentos", url));
  const { url: target, cookie } = buildGoogleAuth(url.searchParams.get("next") ?? "", url.origin);
  const res = NextResponse.redirect(target);
  res.cookies.set(GOOGLE_STATE_COOKIE, cookie, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/api/cuenta/google", maxAge: 600 });
  return res;
}
