-- CreateEnum
CREATE TYPE "IngestionSourceKind" AS ENUM ('OFFICIAL_HTML', 'RSS_JSON', 'JSON_API', 'SITEMAP', 'MANUAL');

-- CreateEnum
CREATE TYPE "IngestionRunStatus" AS ENUM ('QUEUED', 'FETCHING', 'EXTRACTING', 'NEEDS_REVIEW', 'COMPLETED', 'FAILED', 'SKIPPED');

-- CreateEnum
CREATE TYPE "KnowledgeKind" AS ENUM ('EXAM_UPDATE', 'NOTIFICATION', 'SYLLABUS', 'QUESTION', 'LEARNING_TRICK', 'STRATEGY');

-- CreateEnum
CREATE TYPE "KnowledgeStatus" AS ENUM ('DRAFT', 'APPROVED', 'PUBLISHED', 'REJECTED');

-- AlterTable
ALTER TABLE "Exam" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "LearningTrick" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "Organization" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "Paper" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "ParsingJob" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "PrepGuide" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "Syllabus" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "User" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- CreateTable
CREATE TABLE "IngestionSource" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "kind" "IngestionSourceKind" NOT NULL DEFAULT 'OFFICIAL_HTML',
    "url" TEXT NOT NULL,
    "examSlug" TEXT,
    "organizationSlug" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "cadenceMinutes" INTEGER NOT NULL DEFAULT 1440,
    "trustScore" DOUBLE PRECISION NOT NULL DEFAULT 0.7,
    "config" JSONB,
    "lastRunAt" TIMESTAMP(3),
    "nextRunAt" TIMESTAMP(3),
    "lastStatus" "IngestionRunStatus",
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IngestionSource_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IngestionRun" (
    "id" TEXT NOT NULL,
    "sourceId" TEXT,
    "status" "IngestionRunStatus" NOT NULL DEFAULT 'QUEUED',
    "providerUsed" TEXT NOT NULL DEFAULT 'heuristic',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),
    "httpStatus" INTEGER,
    "fetchedUrl" TEXT,
    "contentHash" TEXT,
    "itemsFound" INTEGER NOT NULL DEFAULT 0,
    "itemsCreated" INTEGER NOT NULL DEFAULT 0,
    "itemsUpdated" INTEGER NOT NULL DEFAULT 0,
    "errorMessage" TEXT,
    "summary" TEXT,
    "rawExcerpt" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IngestionRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KnowledgeItem" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "sourceId" TEXT,
    "runId" TEXT,
    "kind" "KnowledgeKind" NOT NULL,
    "status" "KnowledgeStatus" NOT NULL DEFAULT 'DRAFT',
    "title" TEXT NOT NULL,
    "summary" TEXT,
    "content" TEXT NOT NULL,
    "examSlug" TEXT,
    "subject" TEXT,
    "topic" TEXT,
    "sourceUrl" TEXT,
    "sourceName" TEXT,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "confidence" DOUBLE PRECISION NOT NULL DEFAULT 0.6,
    "extractedJson" JSONB,
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "KnowledgeItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "IngestionSource_slug_key" ON "IngestionSource"("slug");

-- CreateIndex
CREATE INDEX "IngestionSource_enabled_nextRunAt_idx" ON "IngestionSource"("enabled", "nextRunAt");

-- CreateIndex
CREATE INDEX "IngestionRun_sourceId_startedAt_idx" ON "IngestionRun"("sourceId", "startedAt");

-- CreateIndex
CREATE INDEX "IngestionRun_status_startedAt_idx" ON "IngestionRun"("status", "startedAt");

-- CreateIndex
CREATE UNIQUE INDEX "KnowledgeItem_slug_key" ON "KnowledgeItem"("slug");

-- CreateIndex
CREATE INDEX "KnowledgeItem_status_kind_idx" ON "KnowledgeItem"("status", "kind");

-- CreateIndex
CREATE INDEX "KnowledgeItem_examSlug_idx" ON "KnowledgeItem"("examSlug");

-- CreateIndex
CREATE INDEX "KnowledgeItem_runId_idx" ON "KnowledgeItem"("runId");

-- AddForeignKey
ALTER TABLE "IngestionRun" ADD CONSTRAINT "IngestionRun_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "IngestionSource"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KnowledgeItem" ADD CONSTRAINT "KnowledgeItem_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "IngestionSource"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KnowledgeItem" ADD CONSTRAINT "KnowledgeItem_runId_fkey" FOREIGN KEY ("runId") REFERENCES "IngestionRun"("id") ON DELETE SET NULL ON UPDATE CASCADE;
