-- 7H EXPERIENCE · PARTE 1 de 3. Solo AGREGA (no borra ni cambia datos). Se puede correr varias veces sin problema.
-- Crea las tablas nuevas, sus índices y su seguridad (RLS). No toca ninguna tabla existente.

DO $$ BEGIN
  CREATE TYPE "ModerationStatus" AS ENUM ('PENDIENTE', 'APROBADA', 'RECHAZADA', 'OCULTA');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "ProductRequestStatus" AS ENUM ('NUEVA', 'EN_REVISION', 'COTIZANDO', 'DISPONIBLE', 'NO_DISPONIBLE', 'FINALIZADA');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "InquiryTopic" AS ENUM ('DISPONIBILIDAD', 'TALLAS', 'CARACTERISTICAS', 'SOLICITUD_ESPECIAL', 'ENVIOS', 'PEDIDOS', 'GARANTIAS', 'OTRO');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "InquiryStatus" AS ENUM ('ABIERTA', 'RESPONDIDA', 'CERRADA');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "MediaKind" AS ENUM ('IMAGEN', 'VIDEO');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "CommunityCategory" AS ENUM ('RECOMENDACIONES', 'TECNOLOGIA', 'MODA_ESTILO', 'PRODUCTOS_QUE_BUSCAMOS', 'NOVEDADES', 'PREGUNTAS');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS "Review" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "rating" INTEGER NOT NULL,
    "title" TEXT,
    "body" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "verified" BOOLEAN NOT NULL DEFAULT false,
    "status" "ModerationStatus" NOT NULL DEFAULT 'PENDIENTE',
    "moderationNote" TEXT,
    "helpfulCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Review_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "ReviewPhoto" (
    "id" TEXT NOT NULL,
    "reviewId" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "mime" TEXT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReviewPhoto_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "ReviewVote" (
    "reviewId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReviewVote_pkey" PRIMARY KEY ("reviewId","customerId")
);

CREATE TABLE IF NOT EXISTS "ProductRequest" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "customerId" TEXT,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "productName" TEXT NOT NULL,
    "brand" TEXT,
    "model" TEXT,
    "url" TEXT,
    "imagePath" TEXT,
    "imageMime" TEXT,
    "budgetCOP" INTEGER,
    "comments" TEXT,
    "status" "ProductRequestStatus" NOT NULL DEFAULT 'NUEVA',
    "adminReply" TEXT,
    "repliedAt" TIMESTAMP(3),
    "productId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductRequest_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "Inquiry" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "accessHash" TEXT NOT NULL,
    "customerId" TEXT,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "topic" "InquiryTopic" NOT NULL,
    "subject" TEXT NOT NULL,
    "productSlug" TEXT,
    "status" "InquiryStatus" NOT NULL DEFAULT 'ABIERTA',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Inquiry_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "InquiryMessage" (
    "id" TEXT NOT NULL,
    "inquiryId" TEXT NOT NULL,
    "author" TEXT NOT NULL,
    "adminId" TEXT,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InquiryMessage_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "MediaItem" (
    "id" TEXT NOT NULL,
    "kind" "MediaKind" NOT NULL DEFAULT 'IMAGEN',
    "source" TEXT NOT NULL,
    "customerId" TEXT,
    "productId" TEXT,
    "path" TEXT NOT NULL,
    "mime" TEXT,
    "caption" TEXT,
    "displayName" TEXT,
    "consentAt" TIMESTAMP(3),
    "status" "ModerationStatus" NOT NULL DEFAULT 'PENDIENTE',
    "featured" BOOLEAN NOT NULL DEFAULT false,
    "withdrawnAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MediaItem_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "CommunityPost" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "category" "CommunityCategory" NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "imagePath" TEXT,
    "imageMime" TEXT,
    "status" "ModerationStatus" NOT NULL DEFAULT 'APROBADA',
    "pinned" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CommunityPost_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "CommunityComment" (
    "id" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    "customerId" TEXT,
    "adminId" TEXT,
    "parentId" TEXT,
    "displayName" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "status" "ModerationStatus" NOT NULL DEFAULT 'APROBADA',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CommunityComment_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "CommunityReaction" (
    "postId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CommunityReaction_pkey" PRIMARY KEY ("postId","customerId")
);

CREATE TABLE IF NOT EXISTS "CommunityReport" (
    "id" TEXT NOT NULL,
    "postId" TEXT,
    "commentId" TEXT,
    "customerId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CommunityReport_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "Review_productId_status_idx" ON "Review"("productId", "status");

CREATE INDEX IF NOT EXISTS "Review_status_createdAt_idx" ON "Review"("status", "createdAt");

CREATE UNIQUE INDEX IF NOT EXISTS "Review_productId_customerId_key" ON "Review"("productId", "customerId");

CREATE INDEX IF NOT EXISTS "ReviewPhoto_reviewId_idx" ON "ReviewPhoto"("reviewId");

CREATE UNIQUE INDEX IF NOT EXISTS "ProductRequest_code_key" ON "ProductRequest"("code");

CREATE INDEX IF NOT EXISTS "ProductRequest_status_createdAt_idx" ON "ProductRequest"("status", "createdAt");

CREATE INDEX IF NOT EXISTS "ProductRequest_email_idx" ON "ProductRequest"("email");

CREATE UNIQUE INDEX IF NOT EXISTS "Inquiry_code_key" ON "Inquiry"("code");

CREATE INDEX IF NOT EXISTS "Inquiry_status_updatedAt_idx" ON "Inquiry"("status", "updatedAt");

CREATE INDEX IF NOT EXISTS "Inquiry_email_idx" ON "Inquiry"("email");

CREATE INDEX IF NOT EXISTS "InquiryMessage_inquiryId_createdAt_idx" ON "InquiryMessage"("inquiryId", "createdAt");

CREATE INDEX IF NOT EXISTS "MediaItem_status_createdAt_idx" ON "MediaItem"("status", "createdAt");

CREATE INDEX IF NOT EXISTS "CommunityPost_status_createdAt_idx" ON "CommunityPost"("status", "createdAt");

CREATE INDEX IF NOT EXISTS "CommunityPost_category_status_idx" ON "CommunityPost"("category", "status");

CREATE INDEX IF NOT EXISTS "CommunityComment_postId_createdAt_idx" ON "CommunityComment"("postId", "createdAt");

CREATE INDEX IF NOT EXISTS "CommunityReport_resolvedAt_idx" ON "CommunityReport"("resolvedAt");

DO $$ BEGIN
  ALTER TABLE "ReviewPhoto" ADD CONSTRAINT "ReviewPhoto_reviewId_fkey" FOREIGN KEY ("reviewId") REFERENCES "Review"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "ReviewVote" ADD CONSTRAINT "ReviewVote_reviewId_fkey" FOREIGN KEY ("reviewId") REFERENCES "Review"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "InquiryMessage" ADD CONSTRAINT "InquiryMessage_inquiryId_fkey" FOREIGN KEY ("inquiryId") REFERENCES "Inquiry"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "CommunityComment" ADD CONSTRAINT "CommunityComment_postId_fkey" FOREIGN KEY ("postId") REFERENCES "CommunityPost"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "CommunityComment" ADD CONSTRAINT "CommunityComment_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "CommunityComment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "CommunityReaction" ADD CONSTRAINT "CommunityReaction_postId_fkey" FOREIGN KEY ("postId") REFERENCES "CommunityPost"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "CommunityReport" ADD CONSTRAINT "CommunityReport_postId_fkey" FOREIGN KEY ("postId") REFERENCES "CommunityPost"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "CommunityReport" ADD CONSTRAINT "CommunityReport_commentId_fkey" FOREIGN KEY ("commentId") REFERENCES "CommunityComment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE "Review" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "ReviewPhoto" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "ReviewVote" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "ProductRequest" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "Inquiry" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "InquiryMessage" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "MediaItem" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "CommunityPost" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "CommunityComment" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "CommunityReaction" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "CommunityReport" ENABLE ROW LEVEL SECURITY;
