-- 7H EXPERIENCE: cambios de base de datos (SOLO AGREGA: no borra ni modifica datos existentes).
-- Pegar completo en Supabase > SQL Editor > Run. Generado con prisma migrate diff desde el esquema de main.
BEGIN;

-- CreateEnum
CREATE TYPE "ModerationStatus" AS ENUM ('PENDIENTE', 'APROBADA', 'RECHAZADA', 'OCULTA');

-- CreateEnum
CREATE TYPE "ProductRequestStatus" AS ENUM ('NUEVA', 'EN_REVISION', 'COTIZANDO', 'DISPONIBLE', 'NO_DISPONIBLE', 'FINALIZADA');

-- CreateEnum
CREATE TYPE "InquiryTopic" AS ENUM ('DISPONIBILIDAD', 'TALLAS', 'CARACTERISTICAS', 'SOLICITUD_ESPECIAL', 'ENVIOS', 'PEDIDOS', 'GARANTIAS', 'OTRO');

-- CreateEnum
CREATE TYPE "InquiryStatus" AS ENUM ('ABIERTA', 'RESPONDIDA', 'CERRADA');

-- CreateEnum
CREATE TYPE "MediaKind" AS ENUM ('IMAGEN', 'VIDEO');

-- CreateEnum
CREATE TYPE "CommunityCategory" AS ENUM ('RECOMENDACIONES', 'TECNOLOGIA', 'MODA_ESTILO', 'PRODUCTOS_QUE_BUSCAMOS', 'NOVEDADES', 'PREGUNTAS');

-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "badges" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "color" TEXT,
ADD COLUMN     "condition" TEXT,
ADD COLUMN     "features" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "material" TEXT,
ADD COLUMN     "model" TEXT,
ADD COLUMN     "origin" TEXT,
ADD COLUMN     "videoUrl" TEXT,
ADD COLUMN     "warranty" TEXT;

-- CreateTable
CREATE TABLE "Review" (
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

-- CreateTable
CREATE TABLE "ReviewPhoto" (
    "id" TEXT NOT NULL,
    "reviewId" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "mime" TEXT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReviewPhoto_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReviewVote" (
    "reviewId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReviewVote_pkey" PRIMARY KEY ("reviewId","customerId")
);

-- CreateTable
CREATE TABLE "ProductRequest" (
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

-- CreateTable
CREATE TABLE "Inquiry" (
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

-- CreateTable
CREATE TABLE "InquiryMessage" (
    "id" TEXT NOT NULL,
    "inquiryId" TEXT NOT NULL,
    "author" TEXT NOT NULL,
    "adminId" TEXT,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InquiryMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MediaItem" (
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

-- CreateTable
CREATE TABLE "CommunityPost" (
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

-- CreateTable
CREATE TABLE "CommunityComment" (
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

-- CreateTable
CREATE TABLE "CommunityReaction" (
    "postId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CommunityReaction_pkey" PRIMARY KEY ("postId","customerId")
);

-- CreateTable
CREATE TABLE "CommunityReport" (
    "id" TEXT NOT NULL,
    "postId" TEXT,
    "commentId" TEXT,
    "customerId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CommunityReport_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Review_productId_status_idx" ON "Review"("productId", "status");

-- CreateIndex
CREATE INDEX "Review_status_createdAt_idx" ON "Review"("status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Review_productId_customerId_key" ON "Review"("productId", "customerId");

-- CreateIndex
CREATE INDEX "ReviewPhoto_reviewId_idx" ON "ReviewPhoto"("reviewId");

-- CreateIndex
CREATE UNIQUE INDEX "ProductRequest_code_key" ON "ProductRequest"("code");

-- CreateIndex
CREATE INDEX "ProductRequest_status_createdAt_idx" ON "ProductRequest"("status", "createdAt");

-- CreateIndex
CREATE INDEX "ProductRequest_email_idx" ON "ProductRequest"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Inquiry_code_key" ON "Inquiry"("code");

-- CreateIndex
CREATE INDEX "Inquiry_status_updatedAt_idx" ON "Inquiry"("status", "updatedAt");

-- CreateIndex
CREATE INDEX "Inquiry_email_idx" ON "Inquiry"("email");

-- CreateIndex
CREATE INDEX "InquiryMessage_inquiryId_createdAt_idx" ON "InquiryMessage"("inquiryId", "createdAt");

-- CreateIndex
CREATE INDEX "MediaItem_status_createdAt_idx" ON "MediaItem"("status", "createdAt");

-- CreateIndex
CREATE INDEX "CommunityPost_status_createdAt_idx" ON "CommunityPost"("status", "createdAt");

-- CreateIndex
CREATE INDEX "CommunityPost_category_status_idx" ON "CommunityPost"("category", "status");

-- CreateIndex
CREATE INDEX "CommunityComment_postId_createdAt_idx" ON "CommunityComment"("postId", "createdAt");

-- CreateIndex
CREATE INDEX "CommunityReport_resolvedAt_idx" ON "CommunityReport"("resolvedAt");

-- AddForeignKey
ALTER TABLE "Review" ADD CONSTRAINT "Review_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Review" ADD CONSTRAINT "Review_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReviewPhoto" ADD CONSTRAINT "ReviewPhoto_reviewId_fkey" FOREIGN KEY ("reviewId") REFERENCES "Review"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReviewVote" ADD CONSTRAINT "ReviewVote_reviewId_fkey" FOREIGN KEY ("reviewId") REFERENCES "Review"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReviewVote" ADD CONSTRAINT "ReviewVote_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductRequest" ADD CONSTRAINT "ProductRequest_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Inquiry" ADD CONSTRAINT "Inquiry_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InquiryMessage" ADD CONSTRAINT "InquiryMessage_inquiryId_fkey" FOREIGN KEY ("inquiryId") REFERENCES "Inquiry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MediaItem" ADD CONSTRAINT "MediaItem_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MediaItem" ADD CONSTRAINT "MediaItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommunityPost" ADD CONSTRAINT "CommunityPost_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommunityComment" ADD CONSTRAINT "CommunityComment_postId_fkey" FOREIGN KEY ("postId") REFERENCES "CommunityPost"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommunityComment" ADD CONSTRAINT "CommunityComment_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommunityComment" ADD CONSTRAINT "CommunityComment_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "CommunityComment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommunityReaction" ADD CONSTRAINT "CommunityReaction_postId_fkey" FOREIGN KEY ("postId") REFERENCES "CommunityPost"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommunityReaction" ADD CONSTRAINT "CommunityReaction_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommunityReport" ADD CONSTRAINT "CommunityReport_postId_fkey" FOREIGN KEY ("postId") REFERENCES "CommunityPost"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommunityReport" ADD CONSTRAINT "CommunityReport_commentId_fkey" FOREIGN KEY ("commentId") REFERENCES "CommunityComment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommunityReport" ADD CONSTRAINT "CommunityReport_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Seguridad: igual que las demás tablas, sin acceso público directo por la API de Supabase (la tienda usa su propia conexión).
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

COMMIT;
