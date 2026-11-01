# 7H STORE: informe de auditoría, mejoras y despliegue (31 de octubre de 2026)

Rama de trabajo: `mejora-diseno-rendimiento`, subida a GitHub. `main` no se tocó.
Para revisar los cambios: https://github.com/Alexrodriguez5/7h-store/pull/new/mejora-diseno-rendimiento

---

## 1. Diagnóstico inicial

| Área | Hallazgo | Gravedad | Estado |
|---|---|---|---|
| Infraestructura | **El proyecto de Supabase no responde.** El dominio `<ref>.supabase.co` no existe en DNS y el pooler no encuentra la base de datos. Lo más probable es que el plan gratuito se haya pausado por inactividad. Sin base de datos no hay catálogo real, pedidos, panel ni fotos subidas. | **Bloqueante** | Requiere tu acción (sección 8) |
| Despliegue | El repositorio de GitHub **no está conectado a Vercel**: nunca se ha desplegado. | Bloqueante para publicar | Requiere tu inicio de sesión (sección 8) |
| Seguridad (dependencias) | `next` 15.5.27 tenía 1 vulnerabilidad crítica y `zod` 4.6.5 una alta. | Crítica | ✅ Corregido: Next 15.5.28 y zod 4.6.7 |
| Pagos | La página del pedido mostraba "Continuar al pago" **también en pedidos ya pagados, vencidos o cancelados**, lo que permitía cobrar dos veces. | Alta | ✅ Corregido |
| Pagos | Después de pagar en Wompi, el cliente **no volvía a la tienda** (faltaba `redirect-url`). | Media (conversión) | ✅ Corregido |
| Pagos | Los pedidos por transferencia, si faltaba `BANK_ACCOUNT`, mostraban el texto "Configura BANK_ACCOUNT" al cliente. No se mostraban el tipo de cuenta ni el NIT. | Media | ✅ Corregido |
| Validación | Los campos del checkout no tenían longitud máxima (riesgo de abuso de memoria). | Media | ✅ Corregido |
| SEO / XSS | Los datos estructurados del producto se insertaban sin escapar `</script>`. | Media | ✅ Corregido |
| Catálogo | El orden "Novedades" ordenaba por *destacado*, no por fecha. La búsqueda distinguía tildes ("tecnologia" ≠ "Tecnología") y solo buscaba una frase exacta. | Media | ✅ Corregido |
| Catálogo | Las tarjetas no enlazaban a la ficha del producto. | Media | ✅ Corregido (en la primera entrega) |
| SEO | Sin metadatos por categoría, sin URL canónica, sin ícono, sin imagen para compartir, sin datos de la organización ni migas de pan. | Media | ✅ Corregido |
| Legal | Términos y privacidad con datos entre [corchetes]. Envíos y devoluciones de 1 línea, sin retracto ni garantía. Contacto solo con Instagram. | Alta (legal) | ✅ Textos completados. ⚠️ Faltan tus datos (sección 7) |
| Secretos | No hay claves en el historial de Git. Wompi está en **Sandbox** (`pub_test`, `prv_test`). `CRON_SECRET` tiene 10 caracteres (débil). | Baja | ⚠️ Recomendado: `CRON_SECRET` de 32+ caracteres |
| Repositorio | El repositorio de GitHub es **público**. No contiene secretos, pero cualquiera puede ver el código. | Info | Considera hacerlo privado |

**Lo que ya estaba bien y se conservó:** webhook de Wompi con firma verificada, idempotencia y validación de monto y moneda. Reserva atómica de stock y máquina de estados de pedidos. El navegador nunca marca un pedido como pagado. Panel con cuentas individuales, sesiones revocables, límites de intentos, auditoría y CSP.

---

## 2. Cambios realizados

### Diseño y experiencia (primera entrega y esta)
- Estilo moderno en toda la tienda: encabezado translúcido con iconos, botones y tarjetas redondeadas, sombras suaves, menú móvil a pantalla completa (se cierra con Escape).
- **Portada:** hero, categorías con foto, Destacados, **Novedades (nuevo)**, beneficios, **bloque de envíos y métodos de pago (nuevo)** y cierre de marca.
- **Catálogo:** filtros en pastillas, título y SEO propios por categoría, búsqueda sin tildes y por varias palabras.
- **Producto:** migas de pan, galería, **selector de cantidad (nuevo)** que respeta el stock de la talla, avisos de disponibilidad y productos relacionados.
- **Carrito:** fotos, barra de progreso hacia el envío gratis, controles de cantidad.
- **Pedido:** estado claro con mensaje para cada estado, plazo de pago, datos bancarios completos, aviso al volver de Wompi.
- **Panel /admin:** tarjetas, tablas y menú renovados. **Ventas de los últimos 30 días y ticket promedio** calculados con datos reales.

### Rendimiento
- Imágenes en AVIF/WebP con caché de 30 días y tamaños correctos por pantalla. Las primeras imágenes del catálogo se cargan primero.
- El carrito y las tarjetas se redibujan menos veces. Las Novedades reutilizan la consulta que ya está en caché (no agregan carga a la base de datos).

### SEO
- Metadatos (título, descripción, canónica) en inicio, catálogo, cada categoría, producto y páginas de ayuda.
- Open Graph y Twitter. Imagen para compartir generada con la marca (`/opengraph-image`). Ícono 7H.
- Schema.org: `Organization`, `WebSite` con buscador, `Product` con oferta en COP y `BreadcrumbList`.
- Las páginas de pedido y de resultados de búsqueda no se indexan. `sitemap.xml` y `robots.txt` funcionan.

---

## 3. Archivos

**Nuevos:** `src/lib/business.ts` (datos del negocio), `src/lib/seo.ts`, `src/app/icon.svg`, `src/app/opengraph-image.tsx`, `src/components/ui/Icons.tsx`, `tests/store-improvements.test.ts`, este informe.

**Modificados:** `next.config.ts`, `package.json` y `package-lock.json`, `globals.css`, `layout.tsx`, `page.tsx` (inicio), `catalogo/page.tsx`, `producto/[slug]/page.tsx`, `pedido/[id]/page.tsx`, `envios`, `devoluciones`, `contacto`, `como-comprar`, `terminos`, `privacidad`, `LegalPage.tsx`, `Header.tsx`, `Footer.tsx`, `ProductCard.tsx`, `Catalog.tsx`, `FilterBar.tsx`, `CartDrawer.tsx`, `AddToCart.tsx`, `ProductGallery.tsx`, `Button.tsx`, `cart-store.ts`, `filters.ts`, `checkout.ts` (esquema), `wompi.ts`, `admin-queries.ts`, panel `/admin` (estilos), `.env.example` y `tests/filters.test.ts`.

**No se tocó:** esquema de Prisma (sin migraciones), reserva de stock, webhook (solo se agregó la URL de regreso), sesiones y permisos del panel ni datos de la base.

---

## 4. Resultados de las pruebas (ejecutadas en tu equipo)

| Comando | Resultado |
|---|---|
| `npm run typecheck` | ✅ 0 errores |
| `npm run lint` | ✅ 0 errores |
| `npm test` | ✅ 15 archivos, **158 pruebas** (antes 146) |
| `npm run build` | ✅ Compila. En Windows, `prisma generate` puede fallar si `npm run dev` está abierto, porque el archivo está bloqueado: cierra el servidor antes de compilar. |
| `npm audit --omit=dev` | ⚠️ Quedan 4 avisos "altos", todos de herramientas de **compilación**: el `postcss` interno de Next y `deepmerge-ts` de la CLI de Prisma. No se ejecutan con datos de los visitantes. Solo se corrigen subiendo a Next 16 o Prisma 7, que son cambios grandes; recomendado más adelante. |
| Navegador (con datos de ejemplo temporales) | ✅ Las 16 rutas públicas responden 200. Probados: búsqueda sin tildes, talla, cantidad, agregar al carrito, carrito, menú móvil, páginas legales, sin desbordamiento horizontal en 375 px. |

### Pruebas con tu base de datos real (después de reactivar Supabase)
| Prueba | Resultado |
|---|---|
| Conexión a Supabase y Storage | ✅ 17 productos activos, 4 categorías, 48 variantes, 1 admin. Las fotos subidas cargan (200). |
| Rutas públicas con datos reales | ✅ Inicio, catálogo, categoría, búsqueda, checkout, rastreo, sitemap (30 URL) y login del panel. |
| Validación del checkout | ✅ Al enviar vacío, cada campo muestra su error. **Antes no se mostraban (bug corregido).** |
| Cobertura del checkout | ✅ 32 departamentos + Bogotá D.C. **Antes había solo 10 departamentos con pocas ciudades (bug corregido).** |
| Crear pedido con tarjeta | ✅ Pedido de prueba **7H-2026-AD612683** (Mochila Classic, $337.000). Reservó 1 unidad (stock 13 → 12). Pago PENDING. |
| Wompi Sandbox: abrir checkout | ✅ "Modo de pruebas", comercio "7h Store", $337.000: Wompi aceptó la firma de integridad y la referencia. Se detectó y corrigió que Wompi bloquea (403) la URL de regreso a `localhost`: ahora solo se envía con HTTPS. |
| Webhook falso (firma inválida) | ✅ Rechazado con 400. El pedido sigue pendiente. |
| Rastreo de pedido | ✅ Con correo correcto muestra el pedido; con otro correo, 404 genérico. |
| API del panel sin sesión | ✅ 401. |

**No probado todavía:**
- **Completar el pago Sandbox con tarjeta de prueba.** Requiere aceptar los términos de Wompi en su página: lo haces tú, o me autorizas.
- **Webhook real de Wompi.** Necesita una URL pública (Vercel).
- **Panel con sesión.** No uso tu contraseña.

**El pedido de prueba 7H-2026-AD612683 debe cancelarse** desde /admin → Pedidos. Al cancelarlo, la unidad vuelve al inventario. Si no se cancela, expira solo en 24 h con el cron.

---

## 5. Variables de entorno (sin valores)

Del servidor (secretas): `DATABASE_URL`, `ADMIN_SESSION_SECRET`, `ADMIN_PASSWORD` (solo para el arranque), `WOMPI_PUBLIC_KEY`, `WOMPI_PRIVATE_KEY`, `WOMPI_INTEGRITY_SECRET`, `WOMPI_EVENTS_SECRET`, `CRON_SECRET`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `RESEND_API_KEY` (opcional), `EMAIL_FROM` (opcional), `BANK_NAME`, `BANK_ACCOUNT`, `BANK_ACCOUNT_TYPE`, `BANK_HOLDER`, `BANK_DOCUMENT`.

Públicas: `NEXT_PUBLIC_SITE_URL` y **nuevas**: `NEXT_PUBLIC_BUSINESS_LEGAL_NAME`, `NEXT_PUBLIC_BUSINESS_TAX_ID`, `NEXT_PUBLIC_BUSINESS_CITY`, `NEXT_PUBLIC_BUSINESS_ADDRESS`, `NEXT_PUBLIC_BUSINESS_EMAIL`, `NEXT_PUBLIC_BUSINESS_WHATSAPP`, `NEXT_PUBLIC_SHIPPING_TIME` y `NEXT_PUBLIC_LEGAL_UPDATED`.

---

## 6. Configuración pendiente de Supabase, Wompi y Vercel

- **Supabase:** reactivar el proyecto. Luego:
  - Considera el plan Pro: el gratuito se vuelve a pausar.
  - Bucket `product-images` público.
  - Ejecutar `prisma/sql/stock-constraints.sql` y `prisma/sql/enable-rls.sql` si no se hizo.
- **Wompi (Sandbox):** "URL de Eventos" = `https://<url-de-vercel>/api/webhooks/wompi`. Prueba tarjeta aprobada y rechazada, y PSE. **No cambies a llaves de producción** hasta terminar las pruebas.
- **Vercel:** no está conectado. Pasos en la sección 8. Región `yul1`, que coincide con Supabase `ca-central-1`. Cron diario ya configurado.

---

## 7. Datos que solo tú puedes dar (las páginas muestran "[Pendiente: …]")

Razón social o nombre del titular, NIT o cédula, ciudad y dirección, correo de atención, WhatsApp, plazo de entrega real y fecha de actualización de los textos legales. Se configuran como variables `NEXT_PUBLIC_BUSINESS_*` en Vercel y en `.env.local`.
**Revisión jurídica recomendada:** Términos, Privacidad y Devoluciones (retracto, garantía, reversión del pago).

---

## 8. Pasos que requieren tu autorización

1. **Reactivar Supabase** (supabase.com → proyecto → *Restore*). Avísame para probar pedidos, panel y Wompi Sandbox.
2. **Vercel** (vercel.com → *Sign up with GitHub* → *Add New → Project* → importar `Alexrodriguez5/7h-store`):
   - Root Directory: la carpeta del proyecto.
   - Variables de entorno de la sección 5, con los valores de tu `.env.local`, cambiando `NEXT_PUBLIC_SITE_URL` por la URL de Vercel.
   - Desplegar la rama `mejora-diseno-rendimiento` como **Preview**.
3. Registrar la URL de eventos en el panel de Wompi Sandbox.
4. Completar los datos de la sección 7.
5. Opcional: rotar `CRON_SECRET` por uno de 32+ caracteres, hacer privado el repositorio, comprar el dominio y configurar Resend para los correos.
6. **Producción:** solo después de las pruebas Sandbox, con tu autorización explícita: llaves `pub_prod` y `prv_prod` y unir la rama a `main`.

## 9. Estado de Vercel y URL pública
**No desplegado.** No hay una URL pública verificada. Depende de los pasos 1 y 2.
