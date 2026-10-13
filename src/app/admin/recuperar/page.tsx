import type { Metadata } from "next";
import Link from "next/link";
import { AuthCard } from "@/components/admin/AuthCard";
import { RequestResetForm } from "@/components/admin/PasswordResetForms";
import { isEmailConfigured } from "@/lib/email";

export const metadata: Metadata = { title: "Recuperar contraseña", robots: { index: false, follow: false } };

export default function RecoverPage() {
  const enabled = isEmailConfigured();
  return (
    <AuthCard title="Recuperar contraseña" subtitle={enabled ? "Te enviaremos un enlace de un solo uso que vence en 30 minutos." : undefined}>
      {enabled ? (
        <RequestResetForm />
      ) : (
        <p className="text-sm leading-6">
          La recuperación por correo todavía no está configurada en esta tienda. Pide al dueño que restablezca tu contraseña desde <strong>Panel → Usuarios</strong>.
        </p>
      )}
      <Link href="/admin/login" className="mt-6 inline-block text-xs underline">← Volver al inicio de sesión</Link>
    </AuthCard>
  );
}
