import type { Metadata, Viewport } from "next";
import { BUSINESS } from "@/lib/business";
import { jsonLdScript, siteUrl } from "@/lib/seo";
import { Cormorant_Garamond, Montserrat } from "next/font/google";
import { CartDrawer } from "@/components/cart/CartDrawer";
import { Footer } from "@/components/layout/Footer";
import { Header } from "@/components/layout/Header";
import { CartProvider } from "@/components/ui/CartProvider";
import { PublicOnly } from "@/components/layout/PublicOnly";
import { getActiveCategories } from "@/services/products";
import type { Category } from "@/types";
import { Suspense } from "react";
import "./globals.css";

/**
 * Todas las páginas se renderizan en cada visita (nunca quedan "congeladas" desde el build),
 * pero los datos del catálogo salen de la caché de Next y solo se consultan a la base de datos
 * cuando el admin cambia algo o cambia el stock (ver lib/cache.ts).
 */
export const dynamic = "force-dynamic";
const display = Cormorant_Garamond({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-cormorant",
});
const sans = Montserrat({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-montserrat",
});
export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"),
  title: { default: "7H STORE — Calidad. Estilo. Confianza.", template: "%s | 7H STORE" },
  description:
    "Productos originales de EE.UU. con precios en COP, pagos locales y envíos a toda Colombia.",
  applicationName: "7H STORE",
  keywords: ["productos importados", "productos originales de EE.UU.", "tienda online Colombia", "7H STORE", "tenis originales", "relojes", "tecnología"],
  openGraph: {
    title: "7H STORE — Calidad. Estilo. Confianza.",
    description: "Productos originales de EE.UU. con precios en COP, pagos locales y envíos a toda Colombia.",
    type: "website",
    locale: "es_CO",
    siteName: "7H STORE",
    url: "/",
  },
  twitter: { card: "summary_large_image", title: "7H STORE", description: "Calidad. Estilo. Confianza." },
  robots: { index: true, follow: true },
  formatDetection: { telephone: false },
};
export const viewport: Viewport = { themeColor: "#0A0A0A", width: "device-width", initialScale: 1 };
async function loadCategories(): Promise<Category[]> {
  try {
    return await getActiveCategories();
  } catch (e) {
    // Si la base de datos no responde, la tienda sigue mostrándose (sin menú de categorías).
    console.error(
      "[layout] no se pudieron cargar las categorías:",
      e instanceof Error ? e.message : e,
    );
    return [];
  }
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const categories = await loadCategories();
  return (
    <html lang="es-CO" className={`${display.variable} ${sans.variable}`}>
      {/* Extensiones del navegador (p. ej. Monica, Grammarly) agregan atributos al <body>; se ignora esa diferencia. */}
      <body suppressHydrationWarning>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: jsonLdScript([
              { "@context": "https://schema.org", "@type": "Organization", name: "7H STORE", url: siteUrl(), logo: `${siteUrl()}/icon.svg`, slogan: BUSINESS.slogan, sameAs: [BUSINESS.instagram.url] },
              {
                "@context": "https://schema.org",
                "@type": "WebSite",
                name: "7H STORE",
                url: siteUrl(),
                inLanguage: "es-CO",
                potentialAction: { "@type": "SearchAction", target: `${siteUrl()}/catalogo?q={search_term_string}`, "query-input": "required name=search_term_string" },
              },
            ]),
          }}
        />
        <a
          href="#contenido"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:bg-gold focus:px-4 focus:py-3 focus:text-ink"
        >
          Saltar al contenido
        </a>
        <CartProvider>
          <PublicOnly>
            <Suspense fallback={<div className="h-[92px] bg-ink" aria-hidden="true" />}>
              <Header categories={categories} />
            </Suspense>
          </PublicOnly>
          {children}
          <PublicOnly>
            <Footer categories={categories} />
            <CartDrawer />
          </PublicOnly>
        </CartProvider>
      </body>
    </html>
  );
}
