-- Ejecutar en Supabase → SQL Editor DESPUÉS de `npm run db:push`.
--
-- Por qué: Supabase publica el esquema `public` mediante su API REST (Data API). Si una tabla no tiene
-- RLS, cualquiera con la llave "anon" podría leerla (pedidos con datos personales, hashes de contraseñas…).
-- Esta tienda NO usa esa API: habla con PostgreSQL mediante Prisma con el rol `postgres`, que NO está
-- sujeto a RLS. Activar RLS SIN políticas bloquea la API pública y la tienda sigue funcionando igual.
--
-- Para deshacerlo en una tabla: ALTER TABLE "Nombre" DISABLE ROW LEVEL SECURITY;

ALTER TABLE "Category"           ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Product"            ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ProductVariant"     ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Order"              ENABLE ROW LEVEL SECURITY;
ALTER TABLE "OrderItem"          ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Payment"            ENABLE ROW LEVEL SECURITY;
ALTER TABLE "AdminUser"          ENABLE ROW LEVEL SECURITY;
ALTER TABLE "AdminSession"       ENABLE ROW LEVEL SECURITY;
ALTER TABLE "AdminPasswordReset" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "AdminAuditLog"      ENABLE ROW LEVEL SECURITY;
ALTER TABLE "RateLimit"          ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ShippingZone"       ENABLE ROW LEVEL SECURITY;

-- Comprobación: todas deben mostrar rowsecurity = true
SELECT tablename, rowsecurity FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename;
