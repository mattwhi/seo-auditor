CREATE TABLE "ProjectAiSettings" (
  "projectId" TEXT NOT NULL PRIMARY KEY,
  "enabled" BOOLEAN NOT NULL DEFAULT false,
  "mode" TEXT NOT NULL DEFAULT 'manual',
  "maxPagesPerAudit" INTEGER NOT NULL DEFAULT 3,
  "maxAnalysesPerDay" INTEGER NOT NULL DEFAULT 20,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ProjectAiSettings_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE TABLE "AiAnalysis" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "projectId" TEXT NOT NULL,
  "auditId" TEXT NOT NULL,
  "pageId" TEXT NOT NULL,
  "contentFingerprint" TEXT NOT NULL,
  "trigger" TEXT NOT NULL DEFAULT 'manual',
  "model" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'running',
  "summary" TEXT,
  "recommendations" JSONB,
  "inputTokens" INTEGER NOT NULL DEFAULT 0,
  "outputTokens" INTEGER NOT NULL DEFAULT 0,
  "errorCode" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completedAt" TIMESTAMP(3),
  CONSTRAINT "AiAnalysis_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "AiAnalysis_auditId_fkey" FOREIGN KEY ("auditId") REFERENCES "Audit"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "AiAnalysis_pageId_fkey" FOREIGN KEY ("pageId") REFERENCES "Page"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "AiAnalysis_projectId_createdAt_idx" ON "AiAnalysis"("projectId", "createdAt");
CREATE INDEX "AiAnalysis_auditId_pageId_idx" ON "AiAnalysis"("auditId", "pageId");
CREATE INDEX "AiAnalysis_projectId_status_idx" ON "AiAnalysis"("projectId", "status");
