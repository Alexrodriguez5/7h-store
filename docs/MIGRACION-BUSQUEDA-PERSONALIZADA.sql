-- AURA · BÚSQUEDA PERSONALIZADA: cambios de base de datos.
-- SOLO AGREGA: no borra tablas, columnas ni datos, y no cambia tipos de columnas existentes.
-- Se puede ejecutar más de una vez sin efectos (idempotente).
-- Cómo aplicarlo: Supabase > SQL Editor. Ejecuta la PARTE 1, luego la PARTE 2 y luego la PARTE 3
-- (si el editor da tiempo de espera, ejecuta cada parte por separado).
-- Generado con `prisma migrate diff` desde el esquema de main y adaptado para poder repetirse.

-- ═════════════════════════════════════════════════════════════════════
-- PARTE 1 · Nuevos estados de solicitud (fuera de transacción: Postgres lo exige para ADD VALUE)
-- ═════════════════════════════════════════════════════════════════════
ALTER TYPE "ProductRequestStatus" ADD VALUE IF NOT EXISTS 'BUSCANDO_PROVEEDORES';
ALTER TYPE "ProductRequestStatus" ADD VALUE IF NOT EXISTS 'PROPUESTA_PREPARADA';
ALTER TYPE "ProductRequestStatus" ADD VALUE IF NOT EXISTS 'PROPUESTA_ENVIADA';
ALTER TYPE "ProductRequestStatus" ADD VALUE IF NOT EXISTS 'ESPERANDO_CLIENTE';
ALTER TYPE "ProductRequestStatus" ADD VALUE IF NOT EXISTS 'ACEPTADA';
ALTER TYPE "ProductRequestStatus" ADD VALUE IF NOT EXISTS 'RECHAZADA';
ALTER TYPE "ProductRequestStatus" ADD VALUE IF NOT EXISTS 'CONVERTIDA';
ALTER TYPE "ProductRequestStatus" ADD VALUE IF NOT EXISTS 'CERRADA';

-- ═════════════════════════════════════════════════════════════════════
-- PARTE 2 · Tipos, columnas nuevas y tablas
-- ═════════════════════════════════════════════════════════════════════
BEGIN;

DO $$ BEGIN CREATE TYPE "AlternativePriceKind" AS ENUM ('ESTIMADO', 'COTIZADO', 'FINAL'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "AlternativeStatus" AS ENUM ('BORRADOR', 'ENVIADA', 'ACEPTADA', 'RECHAZADA'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "CustomOfferStatus" AS ENUM ('ACTIVA', 'USADA', 'VENCIDA', 'REVOCADA'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Productos privados de una oferta: false para todos los productos actuales (siguen visibles igual que hoy).
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "customOnly" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "ProductRequest" ADD COLUMN IF NOT EXISTS "assignedAdminId" TEXT;
ALTER TABLE "ProductRequest" ADD COLUMN IF NOT EXISTS "closeReason" TEXT;
ALTER TABLE "ProductRequest" ADD COLUMN IF NOT EXISTS "color" TEXT;
ALTER TABLE "ProductRequest" ADD COLUMN IF NOT EXISTS "features" TEXT;
ALTER TABLE "ProductRequest" ADD COLUMN IF NOT EXISTS "firstResponseAt" TIMESTAMP(3);
ALTER TABLE "ProductRequest" ADD COLUMN IF NOT EXISTS "links" TEXT[] DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "ProductRequest" ADD COLUMN IF NOT EXISTS "originalText" TEXT;
ALTER TABLE "ProductRequest" ADD COLUMN IF NOT EXISTS "phone" TEXT;
ALTER TABLE "ProductRequest" ADD COLUMN IF NOT EXISTS "referenceStore" TEXT;
ALTER TABLE "ProductRequest" ADD COLUMN IF NOT EXISTS "size" TEXT;
ALTER TABLE "ProductRequest" ADD COLUMN IF NOT EXISTS "source" TEXT;

CREATE TABLE IF NOT EXISTS "RequestImage" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "mime" TEXT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "RequestImage_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "RequestEvent" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "fromStatus" "ProductRequestStatus",
    "toStatus" "ProductRequestStatus",
    "body" TEXT,
    "internal" BOOLEAN NOT NULL DEFAULT false,
    "authorType" TEXT NOT NULL,
    "adminId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "RequestEvent_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "RequestAlternative" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "round" INTEGER NOT NULL DEFAULT 1,
    "position" INTEGER NOT NULL DEFAULT 0,
    "name" TEXT NOT NULL,
    "brand" TEXT,
    "model" TEXT,
    "imageUrl" TEXT,
    "description" TEXT,
    "features" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "referenceUrl" TEXT,
    "priceKind" "AlternativePriceKind" NOT NULL DEFAULT 'ESTIMADO',
    "priceCOP" INTEGER,
    "extraCostsCOP" INTEGER,
    "shippingCOP" INTEGER,
    "availability" TEXT,
    "deliveryEstimate" TEXT,
    "warranty" TEXT,
    "validUntil" TIMESTAMP(3),
    "notes" TEXT,
    "internalNotes" TEXT,
    "recommended" BOOLEAN NOT NULL DEFAULT false,
    "status" "AlternativeStatus" NOT NULL DEFAULT 'BORRADOR',
    "sentAt" TIMESTAMP(3),
    "respondedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "RequestAlternative_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "RequestAccessToken" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "RequestAccessToken_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "CustomOffer" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "alternativeId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "customerEmail" TEXT NOT NULL,
    "priceCOP" INTEGER NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "status" "CustomOfferStatus" NOT NULL DEFAULT 'ACTIVA',
    "orderId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "CustomOffer_pkey" PRIMARY KEY ("id")
);

COMMIT;

-- ═════════════════════════════════════════════════════════════════════
-- PARTE 3 · Índices, relaciones y seguridad (RLS)
-- ═════════════════════════════════════════════════════════════════════
BEGIN;

CREATE INDEX IF NOT EXISTS "RequestImage_requestId_idx" ON "RequestImage"("requestId");
CREATE INDEX IF NOT EXISTS "RequestEvent_requestId_createdAt_idx" ON "RequestEvent"("requestId", "createdAt");
CREATE INDEX IF NOT EXISTS "RequestAlternative_requestId_round_idx" ON "RequestAlternative"("requestId", "round");
CREATE UNIQUE INDEX IF NOT EXISTS "RequestAccessToken_tokenHash_key" ON "RequestAccessToken"("tokenHash");
CREATE INDEX IF NOT EXISTS "RequestAccessToken_requestId_idx" ON "RequestAccessToken"("requestId");
CREATE UNIQUE INDEX IF NOT EXISTS "CustomOffer_productId_key" ON "CustomOffer"("productId");
CREATE INDEX IF NOT EXISTS "CustomOffer_requestId_idx" ON "CustomOffer"("requestId");
CREATE INDEX IF NOT EXISTS "CustomOffer_customerEmail_idx" ON "CustomOffer"("customerEmail");
CREATE INDEX IF NOT EXISTS "ProductRequest_assignedAdminId_idx" ON "ProductRequest"("assignedAdminId");

DO $$ BEGIN ALTER TABLE "RequestImage" ADD CONSTRAINT "RequestImage_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "ProductRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "RequestEvent" ADD CONSTRAINT "RequestEvent_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "ProductRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "RequestAlternative" ADD CONSTRAINT "RequestAlternative_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "ProductRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "RequestAccessToken" ADD CONSTRAINT "RequestAccessToken_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "ProductRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "CustomOffer" ADD CONSTRAINT "CustomOffer_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "ProductRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "CustomOffer" ADD CONSTRAINT "CustomOffer_alternativeId_fkey" FOREIGN KEY ("alternativeId") REFERENCES "RequestAlternative"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "CustomOffer" ADD CONSTRAINT "CustomOffer_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- La tienda accede con el usuario del servidor (Prisma). Con RLS activo y sin políticas, la API pública
-- de Supabase (anon/authenticated) no puede leer ni escribir estas tablas, igual que las demás tablas.
ALTER TABLE "RequestImage" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "RequestEvent" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "RequestAlternative" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "RequestAccessToken" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "CustomOffer" ENABLE ROW LEVEL SECURITY;

COMMIT;

-- Verificación (opcional): debe devolver 5 filas.
-- SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'
--   AND table_name IN ('RequestImage','RequestEvent','RequestAlternative','RequestAccessToken','CustomOffer');
