-- Ejecutar en Supabase → SQL Editor DESPUÉS de `npm.cmd run db:push` (que crea la tabla "ShippingZone").
-- 1) Bloquea la API pública de Supabase para la tabla nueva (Prisma sigue funcionando; ver enable-rls.sql).
ALTER TABLE "ShippingZone" ENABLE ROW LEVEL SECURITY;

-- 2) Zona inicial: TODO el país con la tarifa actual de la tienda ($18.000) y el plazo de 5 a 10 días hábiles.
--    Así nada cambia para el cliente hasta que edites o dividas las zonas en /admin/envios.
--    Solo se inserta si aún no hay zonas.
INSERT INTO "ShippingZone" ("id", "name", "departments", "priceCOP", "baseWeightGrams", "extraPerKgCOP", "minDays", "maxDays", "active", "sortOrder", "createdAt", "updatedAt")
SELECT 'zona-colombia', 'Todo el país',
  ARRAY['Amazonas','Antioquia','Arauca','Atlántico','Bogotá D.C.','Bolívar','Boyacá','Caldas','Caquetá','Casanare','Cauca','Cesar','Chocó','Córdoba','Cundinamarca','Guainía','Guaviare','Huila','La Guajira','Magdalena','Meta','Nariño','Norte de Santander','Putumayo','Quindío','Risaralda','San Andrés y Providencia','Santander','Sucre','Tolima','Valle del Cauca','Vaupés','Vichada'],
  18000, 1000, 0, 5, 10, true, 0, now(), now()
WHERE NOT EXISTS (SELECT 1 FROM "ShippingZone");

-- Comprobación
SELECT name, "priceCOP", "minDays", "maxDays", array_length(departments, 1) AS departamentos FROM "ShippingZone";
