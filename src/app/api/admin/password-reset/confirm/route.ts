import { NextResponse } from "next/server";
import { z } from "zod";
import { resetPasswordWithToken } from "@/lib/admin/auth";
import { audit } from "@/lib/admin/audit";
import { handleError } from "@/lib/admin/http";
import { MIN, consume, tooMany } from "@/lib/rate-limit";
import { getClientIp, isSameOrigin, readJson } from "@/lib/request";

const schema = z.object({ token: z.string().min(1).max(200), password: z.string().min(1).max(200) });

export async function POST(req: Request) {
  if (!isSameOrigin(req)) return NextResponse.json({ error: "Origen no permitido" }, { status: 403 });
  const ip = getClientIp(req);
  const limit = await consume(`reset-confirm:ip:${ip}`, 10, 15 * MIN);
  if (!limit.allowed) return tooMany(limit.retryAfterSec);
  const parsed = schema.safeParse(await readJson(req));
  if (!parsed.success) return NextResponse.json({ error: "Datos no válidos." }, { status: 400 });
  try {
    const admin = await resetPasswordWithToken(parsed.data.token, parsed.data.password);
    await audit({ action: "auth.password_reset", adminId: admin.id, actorEmail: admin.email, ip });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return handleError(e);
  }
}
