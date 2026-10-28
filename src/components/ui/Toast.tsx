"use client";
import { useEffect } from "react";
export function Toast({message,onClose}:{message:string|null;onClose:()=>void}){useEffect(()=>{if(!message)return;const t=setTimeout(onClose,2200);return()=>clearTimeout(t)},[message,onClose]);if(!message)return null;return <div role="status" className="fixed bottom-5 left-1/2 z-[70] -translate-x-1/2 animate-fade-up rounded-full border border-gold/60 bg-ink px-5 py-3 text-sm text-ivory shadow-lift">{message}</div>}
