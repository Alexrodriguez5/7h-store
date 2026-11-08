-- CEREBRO DE AURA (biblioteca de conocimiento, nivel 1): cambios de base de datos.
-- SOLO AGREGA 4 tablas nuevas e índices. No toca tablas existentes ni datos. Se puede ejecutar más de una vez.
-- Requiere antes docs/MIGRACION-AURA-GEMINI.sql (ya aplicado). Supabase > SQL Editor > pegar todo > Run.
-- Usa la búsqueda de texto en español que trae PostgreSQL (sin extensiones nuevas).

BEGIN;

CREATE TABLE IF NOT EXISTS "KnowledgeEntry" (
    "id" TEXT NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'qa',
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pendiente',
    "source" TEXT NOT NULL,
    "sourceUrl" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "synthetic" BOOLEAN NOT NULL DEFAULT false,
    "contentHash" TEXT NOT NULL,
    "searchText" TEXT NOT NULL,
    "reviewAt" TIMESTAMP(3),
    "duplicateOfId" TEXT,
    "conflictWithId" TEXT,
    "approvedById" TEXT,
    "approvedAt" TIMESTAMP(3),
    "batch" TEXT,
    "hits" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "KnowledgeEntry_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "KnowledgeQuestion" (
    "id" TEXT NOT NULL,
    "entryId" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "searchText" TEXT NOT NULL,
    "synthetic" BOOLEAN NOT NULL DEFAULT false,
    "status" TEXT NOT NULL DEFAULT 'pendiente',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "KnowledgeQuestion_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "KnowledgeRevision" (
    "id" TEXT NOT NULL,
    "entryId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "action" TEXT NOT NULL,
    "snapshot" JSONB NOT NULL,
    "adminId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "KnowledgeRevision_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "AuraKnowledgeGap" (
    "id" TEXT NOT NULL,
    "question" TEXT NOT NULL,
    "normalized" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "entryId" TEXT,
    "score" DOUBLE PRECISION,
    "count" INTEGER NOT NULL DEFAULT 1,
    "status" TEXT NOT NULL DEFAULT 'pendiente',
    "resolvedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "AuraKnowledgeGap_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "KnowledgeEntry_status_category_idx" ON "KnowledgeEntry"("status", "category");
CREATE INDEX IF NOT EXISTS "KnowledgeEntry_contentHash_idx" ON "KnowledgeEntry"("contentHash");
CREATE INDEX IF NOT EXISTS "KnowledgeEntry_batch_idx" ON "KnowledgeEntry"("batch");
CREATE INDEX IF NOT EXISTS "KnowledgeQuestion_entryId_idx" ON "KnowledgeQuestion"("entryId");
CREATE INDEX IF NOT EXISTS "KnowledgeRevision_entryId_createdAt_idx" ON "KnowledgeRevision"("entryId", "createdAt");
CREATE INDEX IF NOT EXISTS "AuraKnowledgeGap_status_kind_idx" ON "AuraKnowledgeGap"("status", "kind");
CREATE INDEX IF NOT EXISTS "AuraKnowledgeGap_normalized_idx" ON "AuraKnowledgeGap"("normalized");
-- Búsqueda de texto en español (se usa cuando la biblioteca crece por encima de ~400 entradas).
CREATE INDEX IF NOT EXISTS "KnowledgeEntry_search_fts_idx" ON "KnowledgeEntry" USING GIN (to_tsvector('spanish', "searchText"));

DO $$ BEGIN ALTER TABLE "KnowledgeQuestion" ADD CONSTRAINT "KnowledgeQuestion_entryId_fkey" FOREIGN KEY ("entryId") REFERENCES "KnowledgeEntry"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "KnowledgeRevision" ADD CONSTRAINT "KnowledgeRevision_entryId_fkey" FOREIGN KEY ("entryId") REFERENCES "KnowledgeEntry"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Sin políticas: solo el servidor de la tienda (Prisma) lee y escribe; la API pública de Supabase no tiene acceso.
ALTER TABLE "KnowledgeEntry" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "KnowledgeQuestion" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "KnowledgeRevision" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "AuraKnowledgeGap" ENABLE ROW LEVEL SECURITY;

COMMIT;
