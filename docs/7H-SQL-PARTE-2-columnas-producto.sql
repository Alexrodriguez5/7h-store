-- 7H EXPERIENCE · PARTE 2 de 3. Solo AGREGA (no borra ni cambia datos). Se puede correr varias veces sin problema.
-- Agrega columnas OPCIONALES a Product. Si la tienda está ocupada espera máx. 5 s; si sale 'lock timeout', vuelve a darle Run.
SET lock_timeout = '5s';

ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS     "badges" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN IF NOT EXISTS     "color" TEXT,
ADD COLUMN IF NOT EXISTS     "condition" TEXT,
ADD COLUMN IF NOT EXISTS     "features" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN IF NOT EXISTS     "material" TEXT,
ADD COLUMN IF NOT EXISTS     "model" TEXT,
ADD COLUMN IF NOT EXISTS     "origin" TEXT,
ADD COLUMN IF NOT EXISTS     "videoUrl" TEXT,
ADD COLUMN IF NOT EXISTS     "warranty" TEXT;
