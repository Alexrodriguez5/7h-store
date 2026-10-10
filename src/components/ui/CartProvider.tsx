"use client";
import { useHydrateCart } from "@/hooks/useHydrateCart";
export function CartProvider({children}:{children:React.ReactNode}){ useHydrateCart(); return <>{children}</>; }
