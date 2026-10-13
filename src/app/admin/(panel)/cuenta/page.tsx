import { requireAdminPage } from "@/lib/admin/guard";
import { prisma } from "@/lib/prisma";
import { ChangePasswordForm, LogoutAllButton } from "@/components/admin/AccountForms";
import { Card, PageHeader, fmtDate } from "@/components/admin/ui";

export const metadata = { title: "Mi cuenta" };

export default async function AccountPage() {
  const me = await requireAdminPage();
  const sessions = await prisma.adminSession.findMany({
    where: { adminId: me.id, revokedAt: null, expiresAt: { gt: new Date() } },
    orderBy: { createdAt: "desc" },
    take: 10,
    select: { id: true, createdAt: true, ip: true, userAgent: true },
  });
  return (
    <>
      <PageHeader title="Mi cuenta" subtitle={`${me.name} · ${me.email} · ${me.role === "OWNER" ? "Dueño" : "Administrador"}`} />
      <div className="grid gap-6 xl:grid-cols-2">
        <Card title="Cambiar contraseña"><ChangePasswordForm /></Card>
        <Card title="Sesiones abiertas">
          <ul className="divide-y divide-ink/10 text-sm">
            {sessions.map((s) => (
              <li key={s.id} className="py-2.5">
                <span className="font-semibold">{s.id === me.sessionId ? "Este dispositivo" : "Otro dispositivo"}</span> · desde {fmtDate(s.createdAt)}
                <span className="block truncate text-[11px] text-ink-soft">{s.ip ?? "IP desconocida"} · {s.userAgent ?? "navegador desconocido"}</span>
              </li>
            ))}
          </ul>
          <p className="mt-4 text-xs leading-5 text-ink-soft">Las sesiones vencen a las 8 horas. Si perdiste un equipo o sospechas un acceso indebido, ciérralas todas y cambia tu contraseña.</p>
          <div className="mt-4"><LogoutAllButton /></div>
        </Card>
      </div>
    </>
  );
}
