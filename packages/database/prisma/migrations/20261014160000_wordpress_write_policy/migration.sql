CREATE TABLE "WordPressWritePolicy" (
  "projectId" TEXT NOT NULL,
  "enabled" BOOLEAN NOT NULL DEFAULT false,
  "updatedById" TEXT NOT NULL,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "WordPressWritePolicy_pkey" PRIMARY KEY ("projectId")
);
CREATE INDEX "WordPressWritePolicy_enabled_idx" ON "WordPressWritePolicy"("enabled");
