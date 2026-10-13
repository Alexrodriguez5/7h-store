import type { Metadata } from "next";
import Link from "next/link";
import { AuthCard } from "@/components/admin/AuthCard";
import { SetupForm } from "@/components/admin/SetupForm";
import { countAdmins } from "@/lib/admin/auth";

export const metadata: Metadata = { title: "Configuración inicial", robots: { index: false, follow: false } };

export default async function SetupPage() {
  let count: number | null = null;
  try {
    count = await countAdmins();
  } catch {
    count = null;
  }
  if (count === null) {
    return (
      <AuthCard title="No se pudo leer la base de datos">
        <p className="text-sm leading-6">Ejecuta <code>npm.cmd run db:push</code> para crear las tablas nuevas y vuelve a abrir esta página.</p>
      </AuthCard>
    );
  }
  if (count > 0) {
    return (
      <AuthCard title="La configuración inicial ya se completó">
        <p className="text-sm leading-6">Las cuentas nuevas solo las crea el dueño desde el panel (Usuarios).</p>
        <Link href="/admin/login" className="mt-5 inline-block text-sm font-semibold underline">Ir al inicio de sesión</Link>
      </AuthCard>
    );
  }
  return (
    <AuthCard title="Crea la cuenta del dueño" subtitle="Solo se puede hacer una vez. Después, esta página queda deshabilitada y no existe registro público de administradores.">
      <SetupForm />
    </AuthCard>
  );
}
