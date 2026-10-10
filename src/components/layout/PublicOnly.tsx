"use client";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

/** Oculta el encabezado, pie y carrito de la tienda dentro del panel /admin. */
export function PublicOnly({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  if (pathname?.startsWith("/admin")) return null;
  return <>{children}</>;
}
