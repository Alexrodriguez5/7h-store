-- AURA conversacional (Gemini, nivel gratuito): cambios de base de datos.
-- SOLO AGREGA: no borra tablas, columnas ni datos. Los códigos históricos de solicitudes no cambian.
-- Se puede ejecutar más de una vez (idempotente). Supabase > SQL Editor > pegar todo > Run.
-- Generado con `prisma migrate diff` desde el esquema de main y adaptado para poder repetirse.

BEGIN;

ALTER TABLE "ProductRequest" ADD COLUMN IF NOT EXISTS "auraConversationId" TEXT;
ALTER TABLE "ProductRequest" ADD COLUMN IF NOT EXISTS "auraPending" TEXT[] DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "ProductRequest" ADD COLUMN IF NOT EXISTS "auraPriority" TEXT;
ALTER TABLE "ProductRequest" ADD COLUMN IF NOT EXISTS "auraSummary" TEXT;

CREATE TABLE IF NOT EXISTS "AuraConversation" (
    "id" TEXT NOT NULL,
    "customerId" TEXT,
    "ipHash" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'abierta',
    "draft" JSONB,
    "messageCount" INTEGER NOT NULL DEFAULT 0,
    "tokensIn" INTEGER NOT NULL DEFAULT 0,
    "tokensOut" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "AuraConversation_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "AuraMessage" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "tools" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "redacted" BOOLEAN NOT NULL DEFAULT false,
    "attachments" INTEGER NOT NULL DEFAULT 0,
    "tokensIn" INTEGER NOT NULL DEFAULT 0,
    "tokensOut" INTEGER NOT NULL DEFAULT 0,
    "errorKind" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AuraMessage_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "AuraConversation_createdAt_idx" ON "AuraConversation"("createdAt");
CREATE INDEX IF NOT EXISTS "AuraConversation_customerId_idx" ON "AuraConversation"("customerId");
CREATE INDEX IF NOT EXISTS "AuraMessage_conversationId_createdAt_idx" ON "AuraMessage"("conversationId", "createdAt");
CREATE INDEX IF NOT EXISTS "AuraMessage_createdAt_idx" ON "AuraMessage"("createdAt");
CREATE UNIQUE INDEX IF NOT EXISTS "ProductRequest_auraConversationId_key" ON "ProductRequest"("auraConversationId");

DO $$ BEGIN ALTER TABLE "ProductRequest" ADD CONSTRAINT "ProductRequest_auraConversationId_fkey" FOREIGN KEY ("auraConversationId") REFERENCES "AuraConversation"("id") ON DELETE SET NULL ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "AuraConversation" ADD CONSTRAINT "AuraConversation_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "AuraMessage" ADD CONSTRAINT "AuraMessage_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "AuraConversation"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- La tienda accede con el usuario del servidor (Prisma). Con RLS activo y sin políticas, la API pública
-- de Supabase (anon/authenticated) no puede leer ni escribir las conversaciones.
ALTER TABLE "AuraConversation" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "AuraMessage" ENABLE ROW LEVEL SECURITY;

COMMIT;

-- Verificación (opcional): debe devolver 2 filas.
-- SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name IN ('AuraConversation','AuraMessage');
