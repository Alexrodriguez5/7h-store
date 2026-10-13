import type { Metadata } from "next";
import type { ReactNode } from "react";
import { AdminShell } from "@/components/admin/AdminShell";
import { requireAdminPage } from "@/lib/admin/guard";

export const metadata: Metadata = { title: { default: "Admin", template: "%s | Admin 7H" }, robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function PanelLayout({ children }: { children: ReactNode }) {
  const admin = await requireAdminPage();
  return <AdminShell admin={{ name: admin.name, email: admin.email, role: admin.role }}>{children}</AdminShell>;
}
