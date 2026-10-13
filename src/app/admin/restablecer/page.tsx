import type { Metadata } from "next";
import Link from "next/link";
import { AuthCard } from "@/components/admin/AuthCard";
import { ConfirmResetForm } from "@/components/admin/PasswordResetForms";

export const metadata: Metadata = { title: "Nueva contraseña", robots: { index: false, follow: false }, referrer: "no-referrer" };

export default async function ResetPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token } = await searchParams;
  return (
    <AuthCard title="Elige una nueva contraseña">
      {token ? <ConfirmResetForm token={token} /> : <p className="text-sm">El enlace no es válido. <Link href="/admin/recuperar" className="underline">Solicita uno nuevo</Link>.</p>}
    </AuthCard>
  );
}
