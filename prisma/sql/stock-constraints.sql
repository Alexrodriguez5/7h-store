-- Ejecutar UNA vez en el SQL Editor de Supabase DESPUÉS de `npm run db:push`.
-- Segunda línea de defensa: la base de datos rechaza stock negativo aunque el código falle.
ALTER TABLE "ProductVariant" DROP CONSTRAINT IF EXISTS "ProductVariant_stock_nonneg";
ALTER TABLE "ProductVariant" ADD CONSTRAINT "ProductVariant_stock_nonneg" CHECK ("stock" >= 0);
ALTER TABLE "Product" DROP CONSTRAINT IF EXISTS "Product_stock_nonneg";
ALTER TABLE "Product" ADD CONSTRAINT "Product_stock_nonneg" CHECK ("stock" >= 0);
