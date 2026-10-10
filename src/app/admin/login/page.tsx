import type { Metadata } from "next";
import { LoginForm } from "@/components/admin/LoginForm";

export const metadata: Metadata = { title: "Acceso administrativo", robots: { index: false, follow: false } };

export default function AdminLoginPage() {
  return (
    <main id="contenido" className="flex min-h-screen items-center justify-center bg-ink px-5">
      <div className="w-full max-w-sm border border-white/10 bg-ivory p-8">
        <p className="font-display text-3xl font-semibold tracking-widest">7H STORE</p>
        <p className="mt-1 text-[10px] font-semibold uppercase tracking-[0.25em] text-gold">Administración</p>
        <div className="mt-8"><LoginForm /></div>
      </div>
    </main>
  );
}
