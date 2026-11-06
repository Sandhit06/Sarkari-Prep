-- SarkariPrep Initial PostgreSQL Schema Migration
-- Creates all enums, relational tables, foreign keys, and performance indexes

CREATE TYPE "ExamCategory" AS ENUM ('SSC', 'BANKING', 'RAILWAYS', 'UPSC', 'DEFENCE', 'TEACHING', 'STATE_PSC', 'INSURANCE', 'POLICE', 'PSU');
CREATE TYPE "PaperSourceType" AS ENUM ('OFFICIAL', 'MEMORY_BASED', 'USER_UPLOADED');
CREATE TYPE "VerificationStatus" AS ENUM ('DRAFT', 'NEEDS_REVIEW', 'IN_REVIEW', 'PUBLISHED', 'REJECTED');
CREATE TYPE "QuestionType" AS ENUM ('SINGLE_CHOICE', 'MULTI_CHOICE', 'NUMERICAL');
CREATE TYPE "DifficultyLevel" AS ENUM ('EASY', 'MODERATE', 'HARD');
CREATE TYPE "ParsingStatus" AS ENUM ('QUEUED', 'EXTRACTING_TEXT', 'IDENTIFYING_QUESTIONS', 'STRUCTURING_OPTIONS', 'NEEDS_REVIEW', 'COMPLETED', 'FAILED');
CREATE TYPE "ProctorEventType" AS ENUM ('TAB_SWITCH', 'WINDOW_BLUR', 'FULLSCREEN_EXIT', 'PASTE_ATTEMPT', 'COPY_ATTEMPT', 'RIGHT_CLICK', 'DEVTOOLS_OPEN');
CREATE TYPE "UserRole" AS ENUM ('ASPIRANT', 'CONTRIBUTOR', 'MODERATOR', 'ADMIN');

CREATE TABLE "Organization" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "shortName" TEXT NOT NULL,
    "description" TEXT,
    "websiteUrl" TEXT,
    "isStateBody" BOOLEAN NOT NULL DEFAULT false,
    "stateCode" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Organization_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Organization_slug_key" ON "Organization"("slug");

CREATE TABLE "Exam" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "shortName" TEXT NOT NULL,
    "category" "ExamCategory" NOT NULL,
    "organizationId" TEXT NOT NULL,
    "eligibilitySummary" TEXT NOT NULL,
    "ageLimit" TEXT NOT NULL,
    "qualification" TEXT NOT NULL,
    "hasSectionalTiming" BOOLEAN NOT NULL DEFAULT false,
    "calculatorAllowed" BOOLEAN NOT NULL DEFAULT false,
    "defaultDurationMins" INTEGER NOT NULL DEFAULT 60,
    "defaultTotalMarks" DOUBLE PRECISION NOT NULL DEFAULT 200,
    "defaultNegativeMark" DOUBLE PRECISION NOT NULL DEFAULT 0.50,
    "languagesSupported" TEXT[] DEFAULT ARRAY['en', 'hi']::TEXT[],
    "officialUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Exam_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "Exam_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "Exam_slug_key" ON "Exam"("slug");
CREATE INDEX "Exam_category_idx" ON "Exam"("category");

CREATE TABLE "ExamCycle" (
    "id" TEXT NOT NULL,
    "examId" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "notificationDate" TIMESTAMP(3),
    "applicationStart" TIMESTAMP(3),
    "applicationEnd" TIMESTAMP(3),
    "prelimsDate" TIMESTAMP(3),
    "mainsDate" TIMESTAMP(3),
    "vacanciesCount" INTEGER,
    "officialPdfUrl" TEXT,
    "eligibilityNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ExamCycle_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "ExamCycle_examId_fkey" FOREIGN KEY ("examId") REFERENCES "Exam"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "ExamCycle_examId_year_key" ON "ExamCycle"("examId", "year");

CREATE TABLE "Syllabus" (
    "id" TEXT NOT NULL,
    "examId" TEXT NOT NULL,
    "tierOrStage" TEXT NOT NULL DEFAULT 'Tier I / Prelims',
    "subjectName" TEXT NOT NULL,
    "topicTree" JSONB NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Syllabus_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "Syllabus_examId_fkey" FOREIGN KEY ("examId") REFERENCES "Exam"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "PrepGuide" (
    "id" TEXT NOT NULL,
    "examId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "strategyMarkdown" TEXT NOT NULL,
    "studyPlanWeeks" JSONB NOT NULL,
    "booklist" JSONB NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PrepGuide_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "PrepGuide_examId_fkey" FOREIGN KEY ("examId") REFERENCES "Exam"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT,
    "passwordHash" TEXT,
    "name" TEXT NOT NULL DEFAULT 'Aspirant',
    "isGuest" BOOLEAN NOT NULL DEFAULT false,
    "role" "UserRole" NOT NULL DEFAULT 'ASPIRANT',
    "reputationPoints" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

CREATE TABLE "Profile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "targetExamSlugs" TEXT[],
    "preferredLanguage" TEXT NOT NULL DEFAULT 'en',
    "stateDomicile" TEXT,
    "dailyGoalMinutes" INTEGER NOT NULL DEFAULT 120,
    "publicLeaderboard" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "Profile_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "Profile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "Profile_userId_key" ON "Profile"("userId");

CREATE TABLE "Paper" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "examId" TEXT NOT NULL,
    "examCycleId" TEXT,
    "year" INTEGER NOT NULL,
    "shift" TEXT,
    "setSeries" TEXT,
    "language" TEXT NOT NULL DEFAULT 'en',
    "isMock" BOOLEAN NOT NULL DEFAULT false,
    "isSectional" BOOLEAN NOT NULL DEFAULT false,
    "sourceType" "PaperSourceType" NOT NULL DEFAULT 'OFFICIAL',
    "verificationStatus" "VerificationStatus" NOT NULL DEFAULT 'NEEDS_REVIEW',
    "durationMinutes" INTEGER NOT NULL,
    "totalMarks" DOUBLE PRECISION NOT NULL,
    "hasSectionalTiming" BOOLEAN NOT NULL DEFAULT false,
    "rawFileUrl" TEXT,
    "uploaderId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Paper_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "Paper_examId_fkey" FOREIGN KEY ("examId") REFERENCES "Exam"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Paper_examCycleId_fkey" FOREIGN KEY ("examCycleId") REFERENCES "ExamCycle"("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Paper_uploaderId_fkey" FOREIGN KEY ("uploaderId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "Paper_slug_key" ON "Paper"("slug");
CREATE INDEX "Paper_examId_year_idx" ON "Paper"("examId", "year");

CREATE TABLE "Section" (
    "id" TEXT NOT NULL,
    "paperId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "orderIndex" INTEGER NOT NULL,
    "timeLimitMins" INTEGER,
    "positiveMarks" DOUBLE PRECISION NOT NULL DEFAULT 2.0,
    "negativeMarks" DOUBLE PRECISION NOT NULL DEFAULT 0.5,
    CONSTRAINT "Section_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "Section_paperId_fkey" FOREIGN KEY ("paperId") REFERENCES "Paper"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "Question" (
    "id" TEXT NOT NULL,
    "sectionId" TEXT NOT NULL,
    "questionNumber" INTEGER NOT NULL,
    "type" "QuestionType" NOT NULL DEFAULT 'SINGLE_CHOICE',
    "text" TEXT NOT NULL,
    "textHindi" TEXT,
    "imageUrl" TEXT,
    "options" JSONB NOT NULL,
    "correctOptionId" TEXT NOT NULL,
    "explanation" TEXT,
    "explanationHindi" TEXT,
    "subjectTag" TEXT NOT NULL,
    "topicTag" TEXT NOT NULL,
    "subtopicTag" TEXT,
    "difficulty" "DifficultyLevel" NOT NULL DEFAULT 'MODERATE',
    "marks" DOUBLE PRECISION NOT NULL DEFAULT 2.0,
    "negativeMarks" DOUBLE PRECISION NOT NULL DEFAULT 0.5,
    "sourceConfidence" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "needsHumanReview" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "Question_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "Question_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "Section"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "Question_subjectTag_topicTag_idx" ON "Question"("subjectTag", "topicTag");

CREATE TABLE "AnswerKey" (
    "id" TEXT NOT NULL,
    "paperId" TEXT NOT NULL,
    "officialPdfUrl" TEXT,
    "releasedAt" TIMESTAMP(3),
    "mappings" JSONB NOT NULL,
    "isFinal" BOOLEAN NOT NULL DEFAULT true,
    CONSTRAINT "AnswerKey_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "AnswerKey_paperId_fkey" FOREIGN KEY ("paperId") REFERENCES "Paper"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "AnswerKey_paperId_key" ON "AnswerKey"("paperId");

CREATE TABLE "Attempt" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "paperId" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "submittedAt" TIMESTAMP(3),
    "isCompleted" BOOLEAN NOT NULL DEFAULT false,
    "totalTimeSecs" INTEGER NOT NULL DEFAULT 0,
    "score" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "maxScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "accuracyPercent" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "percentile" DOUBLE PRECISION,
    "sectionalScores" JSONB,
    CONSTRAINT "Attempt_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "Attempt_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Attempt_paperId_fkey" FOREIGN KEY ("paperId") REFERENCES "Paper"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "Attempt_userId_paperId_idx" ON "Attempt"("userId", "paperId");

CREATE TABLE "Response" (
    "id" TEXT NOT NULL,
    "attemptId" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "selectedOptionId" TEXT,
    "status" TEXT NOT NULL,
    "timeSpentSecs" INTEGER NOT NULL DEFAULT 0,
    "flaggedForReview" BOOLEAN NOT NULL DEFAULT false,
    "changedAnswerCount" INTEGER NOT NULL DEFAULT 0,
    "isCorrect" BOOLEAN,
    "marksAwarded" DOUBLE PRECISION NOT NULL DEFAULT 0,
    CONSTRAINT "Response_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "Response_attemptId_fkey" FOREIGN KEY ("attemptId") REFERENCES "Attempt"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Response_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "Question"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "Response_attemptId_questionId_key" ON "Response"("attemptId", "questionId");

CREATE TABLE "ProctorEvent" (
    "id" TEXT NOT NULL,
    "attemptId" TEXT NOT NULL,
    "type" "ProctorEventType" NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "details" TEXT,
    CONSTRAINT "ProctorEvent_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "ProctorEvent_attemptId_fkey" FOREIGN KEY ("attemptId") REFERENCES "Attempt"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "ParsingJob" (
    "id" TEXT NOT NULL,
    "paperId" TEXT,
    "uploaderId" TEXT,
    "fileName" TEXT NOT NULL,
    "fileType" TEXT NOT NULL,
    "rawFileStorageKey" TEXT NOT NULL,
    "status" "ParsingStatus" NOT NULL DEFAULT 'QUEUED',
    "llmProviderUsed" TEXT NOT NULL DEFAULT 'ollama',
    "extractedQuestionCount" INTEGER NOT NULL DEFAULT 0,
    "averageConfidence" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "parsedDraftJson" JSONB,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ParsingJob_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "ParsingJob_paperId_fkey" FOREIGN KEY ("paperId") REFERENCES "Paper"("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "ParsingJob_paperId_key" ON "ParsingJob"("paperId");

CREATE TABLE "ContributionLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "actionType" TEXT NOT NULL,
    "pointsDelta" INTEGER NOT NULL DEFAULT 10,
    "referenceId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ContributionLog_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "ContributionLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "QuestionIssue" (
    "id" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "reporterId" TEXT,
    "issueType" TEXT NOT NULL,
    "suggestedOption" TEXT,
    "comment" TEXT NOT NULL,
    "upvotes" INTEGER NOT NULL DEFAULT 1,
    "isResolved" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "QuestionIssue_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "QuestionIssue_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "Question"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "TakedownReport" (
    "id" TEXT NOT NULL,
    "paperId" TEXT NOT NULL,
    "reporterEmail" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "rightsAttested" BOOLEAN NOT NULL DEFAULT true,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TakedownReport_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "TakedownReport_paperId_fkey" FOREIGN KEY ("paperId") REFERENCES "Paper"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "AnalyticsSnapshot" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "subjectTag" TEXT NOT NULL,
    "topicTag" TEXT NOT NULL,
    "attemptsCount" INTEGER NOT NULL DEFAULT 0,
    "accuracyPercent" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "avgTimePerQSecs" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "masteryScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "computedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AnalyticsSnapshot_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "AnalyticsSnapshot_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "AnalyticsSnapshot_userId_subjectTag_topicTag_key" ON "AnalyticsSnapshot"("userId", "subjectTag", "topicTag");
