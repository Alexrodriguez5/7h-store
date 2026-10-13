# 7H STORE — Auditoría y preparación para producción (v3)

Este documento resume qué se encontró, qué se cambió y por qué, qué debes ejecutar tú y qué queda pendiente.
Los archivos `.env` y `.env.local` **no se abrieron ni se incluyen** en el ZIP.

---

## 1. Diagnóstico (antes de los cambios)

| Área | Estado encontrado | Riesgo |
|---|---|---|
| **Webhook Wompi** | Comparaba el checksum con `!==`. Wompi lo envía en hexadecimal **MAYÚSCULA** y `digest("hex")` produce minúsculas. | **Crítico**: todos los eventos reales se rechazaban con 400 "Firma inválida", así que los pagos aprobados no pasaban a "Pagado". |
| Acceso admin | Una sola contraseña compartida (`ADMIN_PASSWORD`). Límite de intentos en memoria. Sesiones no revocables. Sin auditoría. | Alto (fuerza bruta en serverless, no hay trazabilidad). |
| Categorías | Lista fija en 6 archivos. Solo se podía renombrar. | Funcional. |
| Catálogo público | Sin invalidación de caché: en producción, los cambios del admin podían no verse. | Alto. |
| Editar producto | Reescribía el stock de **todas** las tallas con los valores que se cargaron al abrir el formulario. | **Alto**: guardar una descripción podía "devolver" unidades ya reservadas por una compra (sobreventa). |
| Lentitud al guardar | Hasta 12 consultas **en serie** dentro de una transacción (una por talla) contra Supabase en otra región. Además, `router.refresh()` recargaba tablas completas. Y las miniaturas del admin cargaban la imagen original (hasta 5 MB). | Medio (lentitud real, no de interfaz). |
| Comprobantes de pago | Cualquiera con el código del pedido podía subir archivos. Se confiaba en el tipo enviado por el navegador. Sin límite. | Medio. |
| Rastreo y creación de pedidos | Sin límite de peticiones (un bot podía reservar todo el stock por 24 h). | Medio. |
| `seed.ts` | Al re-ejecutarlo **sobrescribía** precios y stock reales. | Alto si se ejecuta en producción. |
| `backfill-variants.ts` | Repartía el stock en partes iguales entre tallas, inventando existencias. | Medio. |
| Legal | El checkout pide aceptar "términos" y "política de datos", pero esas páginas no existían. | Legal. |
| Otros | Filtro "novedades" repetido 5 veces. Sin CSP/HSTS. La página de contacto no tenía destino para "Saltar al contenido". Contraste bajo en el pie de página. | Bajo. |

**Lo que ya funcionaba y se conservó:** reserva atómica de stock (`updateMany … stock >= qty`), `claimTransition` (evita dobles transiciones y doble liberación de stock), idempotencia del webhook, validación del monto, máquina de estados, stock por talla, validación del tipo real de imagen, HMAC de sesión y el checkout como invitado.

---

## 2. Qué se implementó

### 2.1 Acceso administrativo (prioridad 1)
- **Cuentas individuales** (`AdminUser`) con contraseña cifrada con **scrypt** (N=2¹⁵, unos 100 ms medidos) y política mínima de 12 caracteres.
- **No hay registro público.** El primer dueño se crea en **`/admin/setup`** usando tu `ADMIN_PASSWORD` actual como *llave de arranque*. Después, esa página queda bloqueada para siempre. Las demás cuentas las crea un dueño en **Panel → Usuarios**.
- **Roles:** `OWNER` (dueño: gestiona usuarios) y `ADMIN`. No se puede desactivar ni degradar al último dueño, ni a uno mismo.
- **Sesiones revocables** (`AdminSession`, solo se guarda el hash del token):
  - Cookie `HttpOnly` + `SameSite=Strict` + `Secure` y prefijo `__Host-` en producción. Duran 8 h.
  - Se cierran al cerrar sesión, al cambiar la contraseña, al desactivar la cuenta o con "Cerrar sesión en todos los dispositivos".
- **Límite de intentos persistente** (tabla `RateLimit`, incremento atómico con `INSERT … ON CONFLICT`). Funciona con varias instancias serverless:
  - Login: 5 fallos por correo y 20 por IP cada 15 minutos. Se bloquea *antes* de verificar la contraseña.
  - Los correos se guardan como hash en las claves.
- **Auditoría** (`AdminAuditLog` y **Panel → Auditoría**): accesos, intentos fallidos, productos, inventario, categorías, cambios de estado de pedidos, pagos manuales y cuentas.
- **Recuperación de contraseña:** token aleatorio de un solo uso. Vence en 30 minutos, se guarda solo su hash y la respuesta es genérica. Tiene límite por IP y por correo, y cierra todas las sesiones al usarse.
  - Envía el correo con **Resend** si configuras `RESEND_API_KEY` y `EMAIL_FROM`.
  - Si no está configurado, la página lo dice y **no simula** el envío. El dueño restablece la contraseña desde **Usuarios**, o se usa `npm.cmd run admin -- restablecer correo@…`.
- **Protección en cada API:**
  - Cada handler `/api/admin/*` llama a `requireAdmin()`, que valida la sesión contra la base de datos, el rol y el mismo origen (CSRF). Probado llamando a las APIs directamente, sin sesión.
  - La verificación de origen ahora acepta túneles (`X-Forwarded-Host`) y `NEXT_PUBLIC_SITE_URL`.
- **Mi cuenta:** cambiar contraseña (pide la actual), ver sesiones abiertas y cerrarlas todas.

### 2.2 Categorías (prioridad 2)
- Puedes **crear, renombrar, ordenar, poner imagen de portada, ocultar/mostrar y eliminar** categorías.
- El slug es único, se valida el formato (`relojes-inteligentes`) y hay slugs reservados (`todo`, `admin`…). No se edita después de crear la categoría, porque forma parte de los enlaces.
- **No se puede ocultar** una categoría con productos activos, ni crear o activar productos dentro de una categoría oculta. **Solo se elimina** si no tiene productos (no quedan productos huérfanos).
- El panel muestra los productos activos y totales de cada categoría.
- **La base de datos es la fuente de verdad.** Menú, pie de página, portada, filtros del catálogo, formulario de productos y sitemap leen las categorías de la base. Una categoría nueva aparece sola, sin tocar código.

### 2.3 Productos, imágenes e inventario
- **Guardar escribe solo lo que cambió.** El formulario envía el stock que viste (`expectedStock`):
  - Si no tocaste una talla, no se modifica (las compras hechas mientras editabas se respetan).
  - Si la tocaste y una compra la cambió entre tanto, responde **409** pidiendo recargar, en vez de sobrescribir.
  - El inventario rápido funciona igual: "comparar y cambiar".
- Las imágenes que quitas de un producto se **borran del bucket** si ya no las usa ningún producto ni categoría. Solo se borran archivos que subió la propia tienda.
- Los errores de base de datos (slug duplicado P2002, tiempo agotado P2028) se traducen a mensajes claros.
- Las transacciones tienen 15 s de margen, para una base lejana.
- Los botones evitan envíos dobles y muestran "Guardando…". Después de guardar, la lista de productos muestra un aviso de confirmación.

### 2.4 Pedidos y pagos
- **Webhook:**
  - Checksum comparado sin distinguir mayúsculas y en tiempo constante. También acepta la cabecera `X-Event-Checksum`.
  - Rechaza eventos sin referencia. `ERROR` y `VOIDED` cuentan como no aprobados.
  - **Un aprobado sin monto o en otra moneda NO paga el pedido.**
  - Registra en el log lo que pasó con cada evento (sin secretos).
- **Comprobantes:**
  - Exigen el correo del pedido y solo se aceptan para transferencia/consignación pendiente.
  - Se valida el tipo real (JPG/PNG/PDF), máximo 5 MB y 3 por pedido.
  - El dashboard muestra **"Comprobantes por revisar"**.
- **Límites:** crear pedidos (15 por hora por IP), rastreo (20 cada 10 min) y subida de comprobantes (10 por hora).
- El cron también limpia contadores viejos y refresca el catálogo cuando libera stock.

### 2.5 Velocidad
- **Catálogo:** las páginas se generan en cada visita, pero los datos salen de la **caché de Next** (etiquetas `catalog:products` y `catalog:categories`). La caché se invalida al cambiar productos, categorías o stock, incluidos pedidos creados, cancelados o expirados, con una red de seguridad de 5 minutos.
- **Consultas:** solo se piden los campos necesarios. El listado público ya no trae fechas ni datos internos, y el del admin no trae descripciones.
- **Miniaturas del admin:** pasan por `next/image` (antes se descargaba el original).
- **Inventario:** cada fila se actualiza sola con la respuesta del servidor, sin recargar toda la tabla.

### 2.6 Tienda pública, accesibilidad y legal
- Chips de categoría en el catálogo, con `aria-pressed`. Las etiquetas del filtro activo muestran la categoría.
- Páginas **/terminos** y **/privacidad** (plantillas basadas en la Ley 1480 de 2011 y la Ley 1581 de 2012, **con campos entre [corchetes] por completar**), enlazadas desde el checkout y el pie de página.
- Mejor contraste en el pie de página. `id="contenido"` en Contacto. Imagen genérica para categorías sin imagen.
- **Cabeceras de seguridad:** CSP, HSTS (solo en producción), `X-Frame-Options`, `Cache-Control: no-store` en `/admin` y `/api`, y sin `X-Powered-By`.
- `sitemap.xml` incluye categorías y productos.

---

## 3. Archivos

**Nuevos**

| Archivo | Para qué |
|---|---|
| `src/lib/admin/auth.ts` | Cuentas, sesiones, roles y recuperación |
| `src/lib/admin/audit.ts` | Registro de auditoría |
| `src/lib/rate-limit.ts` | Límite de intentos persistente |
| `src/lib/request.ts` | IP, mismo origen, JSON seguro |
| `src/lib/email.ts` | Resend, sin dependencias |
| `src/lib/cache.ts` | Etiquetas de caché |
| `src/lib/services/categories.ts` | Reglas de categorías |
| `src/lib/services/image-cleanup.ts` | Limpieza de imágenes sin uso |
| `src/app/api/admin/{setup,users,users/[id],account/*,password-reset/*,categories}` | Nuevas APIs |
| `src/app/admin/{setup,recuperar,restablecer}` | Páginas de acceso |
| `src/app/admin/(panel)/{usuarios,cuenta,auditoria}` | Páginas del panel |
| `src/components/admin/{AuthCard,SetupForm,PasswordResetForms,CategoryManager,ImagePicker,AdminUsers,AccountForms}.tsx` | Interfaz |
| `src/app/{terminos,privacidad}`, `src/components/layout/LegalPage.tsx` | Legal |
| `prisma/admin-cli.ts` | Emergencias: `npm.cmd run admin -- …` |
| `prisma/sql/enable-rls.sql` | Bloquea la API pública de Supabase |
| `tests/{api-routes,admin-guard,categories,wompi}.test.ts` | Pruebas nuevas |

**Modificados (motivo)**
- `prisma/schema.prisma`: `Category` (`active`, `sortOrder`, `imageUrl`, `createdAt`) y las tablas `AdminUser`, `AdminSession`, `AdminPasswordReset`, `AdminAuditLog` y `RateLimit`. **Solo se agregan cosas.**
- `src/lib/payments/wompi.ts`: comparación del checksum (el error crítico), cabecera alternativa y estados finales.
- `src/lib/services/order-lifecycle.ts`: monto y moneda obligatorios para pagar, margen en transacciones, y `changeOrderStatus` devuelve si liberó stock.
- `src/lib/services/admin-products.ts`: escritura solo de cambios, `expectedStock`, categoría activa y menos consultas.
- `src/services/products.ts`: caché con etiquetas, campos mínimos, categorías activas.
- `src/app/api/**`: `requireAdmin` (sesión en base de datos, rol, origen), auditoría, invalidación de caché y límites.
- `src/middleware.ts`: rutas públicas del flujo de acceso.
- `src/app/layout.tsx`, `Header.tsx`, `Footer.tsx`, `page.tsx` (inicio), `Catalog.tsx`, `FilterBar.tsx`, `useProductFilters.ts`, `types/index.ts`: categorías dinámicas.
- `ProductForm.tsx`, `InventoryRow.tsx`, inventario, productos y edición: categorías dinámicas, `expectedStock`, sin recargas completas.
- `ProofUploader.tsx` y `api/orders/[id]/proof`: correo obligatorio y validación real.
- `api/orders/*`, `api/cron/expire-orders`: límites, invalidación y comparación segura del secreto.
- `CheckoutForm.tsx`: **solo** el texto de aceptación ahora enlaza a /terminos y /privacidad. La lógica no cambió.
- `orders.ts`: **solo** se agregó margen de tiempo a la transacción.
- `next.config.ts`: cabeceras de seguridad.
- `seed.ts`: ya no sobrescribe datos reales.
- `backfill-variants.ts`: tallas en 0 por defecto.
- `.env.example`: variables nuevas.

**Eliminado:** `src/components/admin/CategoryRename.tsx`, reemplazado por `CategoryManager.tsx`.

**No se tocó:** cálculo de envío, `gateway.ts`, carrito, `AddToCart`, `ProductCard`, galería, rastreo y diseño de la marca.

---

## 4. Variables de entorno nuevas

| Variable | Obligatoria | Uso |
|---|---|---|
| `ADMIN_SESSION_SECRET` | **Sí en producción** | Firma de sesiones (32+ caracteres aleatorios). Ya existía como recomendada. |
| `ADMIN_PASSWORD` | Solo para el arranque | Ya **no** da acceso al panel. Solo sirve para crear el primer dueño en `/admin/setup`. |
| `RESEND_API_KEY`, `EMAIL_FROM` | Opcional | Correos de recuperación de contraseña. |
| `NEXT_PUBLIC_SITE_URL` | **Sí en producción** | Enlaces de correo, sitemap y verificación de origen. |

Todas son del servidor, excepto `NEXT_PUBLIC_SITE_URL`, que es pública por diseño. Ningún secreto usa el prefijo `NEXT_PUBLIC_`.

---

## 5. Pasos que debes ejecutar (PowerShell, dentro de la carpeta `7h`)

1. **Respaldo antes de migrar.** En Supabase → Table Editor, exporta a CSV las tablas `Order`, `OrderItem`, `Payment`, `Product`, `ProductVariant` y `Category`.
2. Copia tus `.env` y `.env.local` a la carpeta nueva y agrega `ADMIN_SESSION_SECRET` si no lo tienes.
3. Ejecuta:
   ```powershell
   npm.cmd install
   npm.cmd run db:generate
   npm.cmd run db:push
   ```
   `db:push` **solo agrega** columnas con valor por defecto y tablas nuevas. **Si muestra una advertencia de pérdida de datos, NO aceptes** y avísame.
4. En Supabase → SQL Editor ejecuta `prisma/sql/enable-rls.sql`. Si aún no lo hiciste, ejecuta también `prisma/sql/stock-constraints.sql`.
5. `npm.cmd run dev` → abre `http://localhost:3000/admin/setup` → escribe tu `ADMIN_PASSWORD` como llave de arranque → crea tu cuenta de dueño.
6. Prueba en Sandbox (ver la sección 7 de `PRODUCCION.md`).
7. Ejecuta `npm.cmd run typecheck`, `npm.cmd run lint`, `npm.cmd test` y **`npm.cmd run build`**. El build no se pudo correr en este entorno (ver la sección 6).

**Supabase Storage:** el bucket `product-images` sigue siendo público para lectura. Eso significa que cualquiera que conozca la URL puede ver la imagen, lo cual es normal para fotos de productos. Nadie puede escribir ni borrar sin la `service_role key`, que solo vive en el servidor.

**Wompi (Sandbox):** la "URL de Eventos" debe ser `https://<tu-dominio-o-túnel>/api/webhooks/wompi`, con el puerto **Público** si usas el túnel de VS Code. Haz una compra nueva y busca en la terminal la línea `[wompi-webhook] 7H-… APPROVED → paid`.

---

## 6. Resultados reales de las pruebas (en este entorno)

| Comando | Resultado |
|---|---|
| `typecheck` (`tsc --noEmit`) | ✅ 0 errores |
| `lint` (`eslint .`) | ✅ 0 errores, 0 advertencias |
| `test` (`vitest run`) | ✅ **14 archivos, 146 pruebas** aprobadas (antes: 10 archivos, 99) |
| `build` (`next build`) | ⚠️ **No ejecutado.** Este entorno no tiene acceso a npm, así que no se pudo instalar el compilador SWC de Next para Linux. Debes correrlo tú. |
| SQL nuevo | ✅ Probado en PostgreSQL 16 local: el contador del límite de intentos, `enable-rls.sql` y `stock-constraints.sql`. 50 incrementos concurrentes dieron exactamente 50. |

Las pruebas usan una base de datos en memoria. **No** se probaron contra tu Supabase ni contra Wompi real, porque no tengo acceso a ninguno de los dos.

**Pruebas nuevas:**
- Configuración inicial única y llave incorrecta.
- Login con error genérico, cookie `HttpOnly`/`SameSite` y bloqueo tras 5 intentos.
- Las 6 APIs admin responden 401 sin sesión, y 403 por rol y por origen.
- Sesión revocada al cerrar sesión y al cambiar la contraseña.
- Token de recuperación de un solo uso, vencido o reemplazado.
- Categorías: slugs duplicados o inválidos, ocultar con productos activos, eliminar con productos.
- Stock que no se pisa (`expectedStock`) y 409 por conflicto.
- Firma de Wompi en mayúsculas, minúsculas, cabecera y evento manipulado.
- Pago sin monto o en otra moneda.
- Comprobantes PDF/JPG sí, SVG/WebP no.
- Número de consultas por acción.

### Mediciones antes/después (operaciones de base de datos, medidas con la base en memoria)

| Acción | Antes | Después | Viajes en serie después* |
|---|---|---|---|
| Crear producto con 6 tallas | 5 (en transacción) | **3** | 2 |
| Editar **solo el precio** (6 tallas) | 12 (transacción y 6 *upserts*) | **4** (sin transacción) | 3 |
| Editar 1 talla (6 tallas) | 12 | **7** | 6 |
| Ajustar 1 talla en Inventario | 5 + recarga completa de la tabla | 5, sin recarga | 4 |
| Calcular un hash scrypt | — | ~100 ms (medido) | — |

\* Las lecturas independientes ahora corren en paralelo. Cada viaje a Supabase cuesta lo que tarde la red: con unos 100–150 ms desde Colombia, *editar el precio* baja de unos 12 viajes en serie a unos 3. **No medí tiempos reales en tu Supabase.** Para comparar, mide en tu equipo con F12 → Red → la petición `PUT /api/admin/products/…`.

---

## 7. Implementado vs. configuración externa

| Implementado en el código | Necesita configuración tuya |
|---|---|
| Cuentas, roles, sesiones, auditoría, límites, setup | `db:push`, crear el dueño en `/admin/setup` |
| Recuperación por correo | Cuenta de Resend con tu dominio verificado y sus variables |
| RLS listo para aplicar | Ejecutar `enable-rls.sql` en Supabase |
| Webhook corregido | URL de eventos en Wompi y una prueba en Sandbox |
| Cron de expiración | `vercel.json` trae uno diario (límite del plan Hobby). Para cada 15–30 min usa cron-job.org con `CRON_SECRET` |
| Latencia con Supabase en Canadá | `vercel.json` ejecuta las funciones en `yul1` (Montréal), la misma región que tu base de datos |
| Páginas legales | **Completar los [corchetes] y revisión de un abogado** |
| CSP/HSTS | Verificar en el navegador (F12 → Consola) que no haya bloqueos |

---

## 8. Pendientes priorizados para producción

1. **Rotar credenciales.** El `.env` estuvo en ZIPs compartidos y en el chat: contraseña de la base de datos, `service_role key`, `WOMPI_*`, `CRON_SECRET` y `ADMIN_PASSWORD`.
2. Ejecutar `npm.cmd run build` y corregir lo que aparezca. Aquí no se pudo.
3. Prueba completa en Sandbox: tarjeta aprobada y rechazada, PSE y transferencia con comprobante. Luego cancelar y expirar, revisando que el stock vuelva.
4. Completar y revisar con un abogado `/terminos`, `/privacidad`, `/devoluciones` y `/envios`.
5. Programar el cron de expiración y configurar Resend.
6. Verificar la CSP en el navegador, tienda y panel, en desarrollo y producción.
7. Fase 2 (opcional): **cuentas de clientes**. Se decidió **no** implementarlas ahora, porque agregan correo verificado, recuperación y protección de datos sin ser necesarias para vender. El checkout como invitado sigue igual.
8. Fase 2: guardar comprobantes en un bucket **privado** de Supabase en vez de la base de datos. Hoy son data URL de máximo 5 MB, hasta 3 por pedido.
9. Fase 2: alerta para pagos aprobados por Wompi y luego anulados (`VOIDED`). Hoy un `VOIDED` posterior a un aprobado se ignora y debe revisarse manualmente en Wompi.
