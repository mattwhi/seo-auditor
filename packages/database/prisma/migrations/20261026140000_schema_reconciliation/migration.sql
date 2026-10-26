-- Reconcile the migration chain with the existing Prisma schema.
-- Preserve existing tables and records.

CREATE TABLE IF NOT EXISTS "GoogleCredential" (
    "projectId" TEXT NOT NULL,
    "encryptedJson" TEXT NOT NULL,
    "accountEmail" TEXT NOT NULL,
    "updatedById" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "GoogleCredential_pkey" PRIMARY KEY ("projectId")
);

ALTER TABLE "ApplicationSetting"
ALTER COLUMN "updatedAt"
DROP DEFAULT;

ALTER TABLE "ProjectIntegration"
ALTER COLUMN "updatedAt"
DROP DEFAULT;

ALTER TABLE "WordPressWritePolicy"
ALTER COLUMN "updatedAt"
DROP DEFAULT;