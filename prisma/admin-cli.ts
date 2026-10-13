/**
 * Herramienta de emergencia para administradores (requiere acceso al servidor y a DATABASE_URL).
 * Útil si el dueño perdió su contraseña y la recuperación por correo no está configurada.
 *
 *   npm.cmd run admin -- listar
 *   npm.cmd run admin -- restablecer correo@dominio.com
 *   npm.cmd run admin -- crear-dueno correo@dominio.com "Nombre Apellido"
 *
 * La contraseña se pide por teclado (no queda en el historial de la terminal).
 */
import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";
import { PrismaClient } from "@prisma/client";
import { hashPassword, passwordPolicyError } from "../src/lib/admin/password";

const prisma = new PrismaClient();

async function askPassword(email: string): Promise<string> {
  const rl = createInterface({ input: stdin, output: stdout, terminal: true });
  const a = await rl.question("Nueva contraseña (12+ caracteres): ");
  const b = await rl.question("Repítela: ");
  rl.close();
  if (a !== b) throw new Error("Las contraseñas no coinciden.");
  const policy = passwordPolicyError(a, email);
  if (policy) throw new Error(policy);
  return a;
}

async function main() {
  const [cmd, emailArg, ...rest] = process.argv.slice(2);
  const email = emailArg?.trim().toLowerCase();
  if (cmd === "listar") {
    const users = await prisma.adminUser.findMany({ select: { email: true, name: true, role: true, active: true }, orderBy: { createdAt: "asc" } });
    console.table(users);
    return;
  }
  if (cmd === "restablecer" && email) {
    const user = await prisma.adminUser.findUnique({ where: { email } });
    if (!user) throw new Error(`No existe un administrador con el correo ${email}.`);
    const passwordHash = await hashPassword(await askPassword(email));
    await prisma.$transaction([
      prisma.adminUser.update({ where: { id: user.id }, data: { passwordHash, passwordChangedAt: new Date(), active: true } }),
      prisma.adminSession.updateMany({ where: { adminId: user.id, revokedAt: null }, data: { revokedAt: new Date() } }),
      prisma.adminAuditLog.create({ data: { action: "auth.password_changed", adminId: user.id, actorEmail: user.email, details: { via: "admin-cli" } } }),
    ]);
    console.log(`✔ Contraseña de ${email} restablecida y sesiones cerradas.`);
    return;
  }
  if (cmd === "crear-dueno" && email) {
    const name = rest.join(" ").trim() || "Dueño";
    if (await prisma.adminUser.findUnique({ where: { email } })) throw new Error("Ya existe una cuenta con ese correo. Usa «restablecer».");
    const passwordHash = await hashPassword(await askPassword(email));
    const u = await prisma.adminUser.create({ data: { email, name, passwordHash, role: "OWNER" } });
    await prisma.adminAuditLog.create({ data: { action: "admin.created", adminId: u.id, actorEmail: email, details: { via: "admin-cli", role: "OWNER" } } });
    console.log(`✔ Dueño ${email} creado.`);
    return;
  }
  console.log("Uso: npm.cmd run admin -- listar | restablecer <correo> | crear-dueno <correo> \"Nombre\"");
}

main()
  .catch((e) => { console.error("✖", e instanceof Error ? e.message : e); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
