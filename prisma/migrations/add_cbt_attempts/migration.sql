-- CBT engine rebuild: server-authoritative exam attempts.
--
-- Every statement is additive, so the pre-rebuild app keeps running against a
-- migrated database. Safe to run before OR after deploying the new code.
--
-- Apply with:  psql "$DATABASE_URL" -f prisma/migrations/add_cbt_attempts/migration.sql

BEGIN;

-- 1. New ExamSession columns -------------------------------------------------
ALTER TABLE "ExamSession" ADD COLUMN IF NOT EXISTS "materialId"    TEXT;
ALTER TABLE "ExamSession" ADD COLUMN IF NOT EXISTS "sourceTitle"   TEXT;
ALTER TABLE "ExamSession" ADD COLUMN IF NOT EXISTS "deadlineAt"    TIMESTAMP(3);
ALTER TABLE "ExamSession" ADD COLUMN IF NOT EXISTS "autoSubmitted" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "ExamSession" ADD COLUMN IF NOT EXISTS "gradingStatus" TEXT NOT NULL DEFAULT 'none';
ALTER TABLE "ExamSession" ADD COLUMN IF NOT EXISTS "gradedAt"      TIMESTAMP(3);
ALTER TABLE "ExamSession" ADD COLUMN IF NOT EXISTS "aiFeedback"    TEXT;
ALTER TABLE "ExamSession" ADD COLUMN IF NOT EXISTS "lastSeenAt"    TIMESTAMP(3);
ALTER TABLE "ExamSession" ADD COLUMN IF NOT EXISTS "schemaVersion" INTEGER NOT NULL DEFAULT 2;

-- 2. Stamp every PRE-EXISTING row as legacy (schemaVersion 1).
--    The startedAt < now() guard means this stays correct even if the new code
--    is already deployed and writing v2 attempts while this runs.
UPDATE "ExamSession" SET "schemaVersion" = 1 WHERE "startedAt" < now();

-- 3. Backfill derived state for existing rows --------------------------------
UPDATE "ExamSession"
   SET "gradingStatus" = 'complete'
 WHERE "status" = 'completed' AND "gradingStatus" = 'none';

UPDATE "ExamSession"
   SET "deadlineAt" = "startedAt" + ("durationSec" * INTERVAL '1 second')
 WHERE "durationSec" IS NOT NULL
   AND "deadlineAt" IS NULL
   AND "status" = 'in_progress';

-- 4. ExamAnswer: one row per question in an attempt, carrying a snapshot ------
CREATE TABLE IF NOT EXISTS "ExamAnswer" (
    "id"            TEXT NOT NULL,
    "attemptId"     TEXT NOT NULL,
    "questionId"    TEXT,
    "orderIndex"    INTEGER NOT NULL,

    "type"          TEXT NOT NULL,
    "prompt"        TEXT NOT NULL,
    "optionsJson"   TEXT,
    "imageUrl"      TEXT,
    "points"        DOUBLE PRECISION NOT NULL DEFAULT 1,
    "correctAnswer" TEXT NOT NULL,
    "explanation"   TEXT,

    "response"      TEXT,
    "answeredAt"    TIMESTAMP(3),

    "isGraded"      BOOLEAN NOT NULL DEFAULT false,
    "isCorrect"     BOOLEAN,
    "awarded"       DOUBLE PRECISION NOT NULL DEFAULT 0,
    "gradeMethod"   TEXT,
    "feedback"      TEXT,
    "confidence"    DOUBLE PRECISION,
    "revealed"      BOOLEAN NOT NULL DEFAULT false,

    "overriddenBy"  TEXT,
    "overrideNote"  TEXT,
    "overriddenAt"  TIMESTAMP(3),

    "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ExamAnswer_pkey" PRIMARY KEY ("id")
);

-- 5. Foreign keys ------------------------------------------------------------
DO $$ BEGIN
    ALTER TABLE "ExamAnswer" ADD CONSTRAINT "ExamAnswer_attemptId_fkey"
        FOREIGN KEY ("attemptId") REFERENCES "ExamSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Question may be deleted later; the snapshot above keeps the attempt gradeable.
DO $$ BEGIN
    ALTER TABLE "ExamAnswer" ADD CONSTRAINT "ExamAnswer_questionId_fkey"
        FOREIGN KEY ("questionId") REFERENCES "Question"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    ALTER TABLE "ExamAnswer" ADD CONSTRAINT "ExamAnswer_overriddenBy_fkey"
        FOREIGN KEY ("overriddenBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    ALTER TABLE "ExamSession" ADD CONSTRAINT "ExamSession_materialId_fkey"
        FOREIGN KEY ("materialId") REFERENCES "Material"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 6. Indexes -----------------------------------------------------------------
CREATE UNIQUE INDEX IF NOT EXISTS "ExamAnswer_attemptId_orderIndex_key" ON "ExamAnswer"("attemptId", "orderIndex");
CREATE INDEX IF NOT EXISTS "ExamAnswer_attemptId_idx"  ON "ExamAnswer"("attemptId");
CREATE INDEX IF NOT EXISTS "ExamAnswer_questionId_idx" ON "ExamAnswer"("questionId");

CREATE INDEX IF NOT EXISTS "ExamSession_userId_startedAt_idx" ON "ExamSession"("userId", "startedAt" DESC);
CREATE INDEX IF NOT EXISTS "ExamSession_userId_status_idx"    ON "ExamSession"("userId", "status");
CREATE INDEX IF NOT EXISTS "ExamSession_materialId_idx"       ON "ExamSession"("materialId");

CREATE INDEX IF NOT EXISTS "Question_type_idx"            ON "Question"("type");
CREATE INDEX IF NOT EXISTS "Question_courseId_type_idx"   ON "Question"("courseId", "type");
CREATE INDEX IF NOT EXISTS "Question_sourceId_type_idx"   ON "Question"("sourceId", "type");

COMMIT;
