# 7H STORE — Panel /admin (cambios)

## Pasos para activarlo (en tu máquina, PowerShell)
1. `npm.cmd install` (no hay dependencias nuevas).
2. En `.env.local` agrega: `ADMIN_SESSION_SECRET` (texto aleatorio de 32+ caracteres), `SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY`.
3. En Supabase → Storage crea un bucket **público** llamado `product-images`.
4. `npm.cmd run db:generate` y `npm.cmd run db:push` (cambios solo aditivos: `Product.active`, tabla `ProductVariant`, `OrderItem.variantId`).
5. En el SQL Editor de Supabase ejecuta `prisma/sql/stock-constraints.sql` (stock nunca negativo).
6. Productos con tallas ya existentes: `npx tsx prisma/backfill-variants.ts` reparte su stock global entre las tallas. Ajusta cada talla en `/admin/inventario`.
7. `npm.cmd run typecheck`, `npm.cmd run lint`, `npm.cmd test`, `npm.cmd run dev` → http://localhost:3000/admin
8. El ZIP original traía un `.env` con valores. Si eran reales, rota DATABASE_URL, WOMPI_PRIVATE_KEY, WOMPI_EVENTS_SECRET y ADMIN_PASSWORD.

## Archivos del frontend público/pagos modificados (y por qué)
- `prisma/schema.prisma`: `active`, `ProductVariant`, `OrderItem.variantId` (necesario para stock por talla y desactivar productos).
- `src/lib/services/orders.ts`: reserva atómica de stock por talla; rechaza productos inactivos; suma líneas repetidas. Firma y respuestas de la API iguales: **CheckoutForm no se tocó**.
- `src/app/api/webhooks/wompi/route.ts`: solo pasa a PAID si el pedido sigue pendiente, valida el monto y es idempotente. Un aprobado tardío sobre pedido expirado queda registrado y se avisa en el dashboard.
- `src/app/api/cron/expire-orders/route.ts`: no expira pedidos que el webhook ya pagó; libera stock una sola vez; exige `CRON_SECRET`.
- `src/lib/payments/wompi.ts`: **solo** se eliminaron los `console.log` que imprimían prefijo/longitud del secreto y checksums. La verificación de firma no cambió.
- `src/services/products.ts`, `src/types/index.ts`: leen solo productos activos y variantes.
- `ProductCard.tsx`, `AddToCart.tsx`: tallas agotadas deshabilitadas y tachadas. `cart-store.ts`: límite = stock de la talla elegida.
- `next.config.ts`: permite el host de Supabase Storage. `layout.tsx` + `PublicOnly.tsx`: oculta Header/Footer/carrito en /admin.
- Reemplazado el admin antiguo (`?key=ADMIN_PASSWORD` en la URL): `api/admin/login` y `api/admin/orders/[id]` ahora son seguros.

## No se tocó
Checkout (`CheckoutForm`, esquema), `shipping.ts`, `gateway.ts`, seguimiento de pedidos, filtros, búsqueda, Header de catálogo y diseño público.

## Seguridad
Cookie HttpOnly/SameSite=Strict/Secure, firmada con HMAC y válida 8 h; comparación de contraseña en tiempo constante; 5 intentos / 15 min; middleware + verificación en CADA página y API; chequeo de Origin en escrituras; Zod en servidor; imágenes validadas por contenido (JPG/PNG/WebP, 5 MB). ADMIN_PASSWORD nunca llega al navegador.
El límite de intentos es en memoria (mejor esfuerzo en serverless).

## Reglas de pedidos
Admin: PAID→PROCESSING→SHIPPED (exige guía)→DELIVERED; cancelar desde pendiente/pagado/preparando. PAID por tarjeta/PSE solo lo pone Wompi; "Confirmar pago manual" existe solo para transferencia/consignación. EXPIRED solo lo pone el cron.
