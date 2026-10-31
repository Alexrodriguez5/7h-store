import type { Metadata } from "next";
import { ResetPasswordForm } from "@/components/account/ResetPasswordForm";

export const metadata: Metadata = { title: "Nueva contraseña", robots: { index: false } };

export default async function ResetPage({ searchParams }: { searchParams: Promise<{ email?: string; token?: string }> }) {
  const sp = await searchParams;
  return (
    <main id="contenido" className="mx-auto max-w-md px-5 py-16">
      <h1 className="font-display text-4xl">Crea una nueva contraseña</h1>
      <p className="mt-2 text-sm text-ink-soft">Mínimo 12 caracteres. Al guardarla se cerrarán tus otras sesiones.</p>
      <div className="mt-8"><ResetPasswordForm email={sp.email ?? ""} token={sp.token ?? ""} /></div>
    </main>
  );
}
