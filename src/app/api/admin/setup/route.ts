import { NextResponse } from "next/server";
import { z } from "zod";
import { setSessionCookie } from "@/lib/admin/session";
import { checkSetupKey } from "@/lib/admin/password";
import { countAdmins, createFirstOwner, createSession } from "@/lib/admin/auth";
import { audit } from "@/lib/admin/audit";
import { handleError } from "@/lib/admin/http";
import { MIN, consume, tooMany } from "@/lib/rate-limit";
import { getClientIp, getUserAgent, isSameOrigin, readJson } from "@/lib/request";

const schema = z.object({
  setupKey: z.string().min(1).max(200),
  name: z.string().trim().min(2, "Escribe tu nombre").max(80),
  email: z.string().trim().email("Correo no válido").max(200),
  password: z.string().min(1).max(200),
});

/**
 * Crea el PRIMER administrador (dueño). Solo funciona mientras no exista ninguno y exige la
 * llave de arranque (el valor de ADMIN_PASSWORD). Después queda deshabilitado para siempre.
 */
export async function POST(req: Request) {
  if (!isSameOrigin(req)) return NextResponse.json({ error: "Origen no permitido" }, { status: 403 });
  const ip = getClientIp(req);
  const limit = await consume(`setup:ip:${ip}`, 5, 15 * MIN);
  if (!limit.allowed) return tooMany(limit.retryAfterSec);
  if (!process.env.ADMIN_PASSWORD) return NextResponse.json({ error: "Falta ADMIN_PASSWORD (llave de arranque) en el servidor." }, { status: 503 });

  const parsed = schema.safeParse(await readJson(req));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Datos no válidos" }, { status: 400 });
  try {
    if ((await countAdmins()) > 0) return NextResponse.json({ error: "La configuración inicial ya se completó. Inicia sesión." }, { status: 409 });
    // 403 (no 401) para que el formulario muestre el error en lugar de redirigir al login.
    if (!checkSetupKey(parsed.data.setupKey)) return NextResponse.json({ error: "La llave de arranque no es correcta." }, { status: 403 });
    const owner = await createFirstOwner(parsed.data);
    await audit({ action: "auth.setup", adminId: owner.id, actorEmail: owner.email, ip });
    const res = NextResponse.json({ ok: true }, { status: 201 });
    setSessionCookie(res, await createSession(owner.id, { ip, userAgent: getUserAgent(req) }));
    return res;
  } catch (e) {
    return handleError(e);
  }
}
