import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { LoginForm } from "@/components/admin/LoginForm";
import { AuthCard } from "@/components/admin/AuthCard";
import { getCurrentAdmin } from "@/lib/admin/guard";
import { countAdmins } from "@/lib/admin/auth";

export const metadata: Metadata = { title: "Acceso administrativo", robots: { index: false, follow: false } };

export default async function AdminLoginPage() {
  if (await getCurrentAdmin().catch(() => null)) redirect("/admin");
  const noAdmins = (await countAdmins().catch(() => 1)) === 0;
  return (
    <AuthCard>
      {noAdmins && (
        <p className="mb-5 border border-gold/50 bg-gold/10 p-3 text-xs leading-5">
          Aún no hay cuentas administrativas. <Link href="/admin/setup" className="font-semibold underline">Crea la cuenta del dueño</Link>.
        </p>
      )}
      <LoginForm />
    </AuthCard>
  );
}
