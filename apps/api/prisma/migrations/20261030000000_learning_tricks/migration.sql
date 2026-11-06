-- Learning shortcuts / tricks feed

CREATE TABLE "LearningTrick" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "topic" TEXT NOT NULL,
    "examTags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "shortcut" TEXT NOT NULL,
    "explanation" TEXT NOT NULL,
    "example" TEXT,
    "exampleHindi" TEXT,
    "mnemonic" TEXT,
    "difficulty" "DifficultyLevel" NOT NULL DEFAULT 'MODERATE',
    "accent" TEXT NOT NULL DEFAULT 'brand',
    "sourceUrl" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isPublished" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "LearningTrick_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "LearningTrick_slug_key" ON "LearningTrick"("slug");
CREATE INDEX "LearningTrick_subject_idx" ON "LearningTrick"("subject");
CREATE INDEX "LearningTrick_isPublished_sortOrder_idx" ON "LearningTrick"("isPublished", "sortOrder");
