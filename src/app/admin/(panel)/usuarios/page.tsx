import { requireAdminPage } from "@/lib/admin/guard";
import { prisma } from "@/lib/prisma";
import { AdminUsers } from "@/components/admin/AdminUsers";
import { PageHeader } from "@/components/admin/ui";

export const metadata = { title: "Usuarios" };

export default async function AdminUsersPage() {
  const me = await requireAdminPage({ role: "OWNER" });
  const now = new Date();
  const users = await prisma.adminUser.findMany({
    orderBy: [{ active: "desc" }, { createdAt: "asc" }],
    select: { id: true, name: true, email: true, role: true, active: true, lastLoginAt: true, _count: { select: { sessions: { where: { revokedAt: null, expiresAt: { gt: now } } } } } },
  });
  return (
    <>
      <PageHeader title="Usuarios" subtitle="Solo el dueño puede crear cuentas administrativas. No existe registro público: cada persona tiene su propia cuenta y todo queda en la auditoría." />
      <AdminUsers meId={me.id} rows={users.map((u) => ({ id: u.id, name: u.name, email: u.email, role: u.role, active: u.active, lastLoginAt: u.lastLoginAt?.toISOString() ?? null, activeSessions: u._count.sessions }))} />
    </>
  );
}
