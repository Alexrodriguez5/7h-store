import { NextResponse } from "next/server";
import { COOKIE_NAME, IS_PROD } from "@/lib/admin/session";
import { requireAdminApi } from "@/lib/admin/guard";

export async function POST(req: Request) {
  const denied = await requireAdminApi(req);
  if (denied) return denied;
  const res = NextResponse.json({ ok: true });
  res.cookies.set(COOKIE_NAME, "", { httpOnly: true, secure: IS_PROD, sameSite: "strict", path: "/", maxAge: 0 });
  return res;
}
