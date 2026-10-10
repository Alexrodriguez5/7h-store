"use client";
import { useEffect } from "react";
import { useCartStore } from "@/store/cart-store";
export function useHydrateCart(){ useEffect(()=>{ useCartStore.persist.rehydrate(); },[]); }
