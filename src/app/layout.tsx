import type { Metadata } from "next";
import { Cormorant_Garamond, Montserrat } from "next/font/google";
import { CartDrawer } from "@/components/cart/CartDrawer";
import { Footer } from "@/components/layout/Footer";
import { Header } from "@/components/layout/Header";
import { CartProvider } from "@/components/ui/CartProvider";
import { PublicOnly } from "@/components/layout/PublicOnly";
import "./globals.css";
const display=Cormorant_Garamond({subsets:["latin"],weight:["400","500","600"],variable:"--font-cormorant"});
const sans=Montserrat({subsets:["latin"],weight:["400","500","600"],variable:"--font-montserrat"});
export const metadata:Metadata={metadataBase:new URL(process.env.NEXT_PUBLIC_SITE_URL??"http://localhost:3000"),title:{default:"7H STORE — Calidad. Estilo. Confianza.",template:"%s | 7H STORE"},description:"Productos originales de EE.UU. con precios en COP, pagos locales y envíos a toda Colombia.",openGraph:{title:"7H STORE",description:"Calidad. Estilo. Confianza.",type:"website"}};
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="es-CO" className={`${display.variable} ${sans.variable}`}><body><a href="#contenido" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:bg-gold focus:px-4 focus:py-3 focus:text-ink">Saltar al contenido</a><CartProvider><PublicOnly><Header/></PublicOnly>{children}<PublicOnly><Footer/><CartDrawer/></PublicOnly></CartProvider></body></html>}
