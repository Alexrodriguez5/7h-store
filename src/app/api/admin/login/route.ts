import { NextResponse } from "next/server";
import { z } from "zod";
import { setSessionCookie } from "@/lib/admin/session";
import { authenticate, countAdmins, createSession, normalizeEmail } from "@/lib/admin/auth";
import { audit } from "@/lib/admin/audit";
import { MIN, clearLimit, hashedKey, isBlocked, registerHit } from "@/lib/rate-limit";
import { getClientIp, getUserAgent, isSameOrigin, readJson } from "@/lib/request";

const schema = z.object({ email: z.string().trim().email().max(200), password: z.string().min(1).max(200) });
const WINDOW = 15 * MIN;
const PER_EMAIL = 5;
const PER_IP = 20;
const GENERIC = "Correo o contraseña incorrectos.";

export async function POST(req: Request) {
  if (!isSameOrigin(req)) return NextResponse.json({ error: "Origen no permitido" }, { status: 403 });
  const parsed = schema.safeParse(await readJson(req));
  if (!parsed.success) return NextResponse.json({ error: "Escribe tu correo y tu contraseña." }, { status: 400 });

  const email = normalizeEmail(parsed.data.email);
  const ip = getClientIp(req);
  const emailKey = hashedKey("login:email", email);
  const ipKey = `login:ip:${ip}`;

  // Se bloquea ANTES de verificar la contraseña: no hay forma de seguir probando durante la ventana.
  if ((await isBlocked(emailKey, PER_EMAIL)) || (await isBlocked(ipKey, PER_IP))) {
    return NextResponse.json({ error: "Demasiados intentos. Espera 15 minutos e inténtalo de nuevo." }, { status: 429, headers: { "Retry-After": "900" } });
  }

  try {
    if ((await countAdmins()) === 0) {
      return NextResponse.json({ error: "Aún no hay administradores. Crea el primero en /admin/setup.", setup: true }, { status: 409 });
    }
    const admin = await authenticate(email, parsed.data.password);
    if (!admin) {
      await registerHit(emailKey, WINDOW);
      await registerHit(ipKey, WINDOW);
      await audit({ action: "auth.login_failed", actorEmail: email, ip });
      return NextResponse.json({ error: GENERIC }, { status: 401 });
    }
    await clearLimit(emailKey);
    const token = await createSession(admin.id, { ip, userAgent: getUserAgent(req) });
    await audit({ action: "auth.login", adminId: admin.id, actorEmail: admin.email, ip });
    const res = NextResponse.json({ ok: true });
    setSessionCookie(res, token);
    return res;
  } catch (e) {
    console.error("[admin-login] error:", e instanceof Error ? e.message : e);
    return NextResponse.json({ error: "No se pudo iniciar sesión. Verifica que la base de datos esté actualizada (npm run db:push)." }, { status: 503 });
  }
}
