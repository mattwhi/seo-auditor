-- Human-reviewed AI suggestions; approval does not execute remediation.
CREATE TABLE "AiRemediationReview" (
  "id" TEXT NOT NULL,
  "analysisId" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "suggestionIndex" INTEGER NOT NULL,
  "ruleId" TEXT NOT NULL,
  "field" TEXT NOT NULL,
  "priority" TEXT NOT NULL,
  "currentValue" TEXT NOT NULL,
  "proposedValue" TEXT NOT NULL,
  "explanation" TEXT NOT NULL,
  "evidence" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'pending',
  "reviewerId" TEXT,
  "reviewedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AiRemediationReview_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "AiRemediationReview_analysisId_suggestionIndex_key" ON "AiRemediationReview"("analysisId", "suggestionIndex");
CREATE INDEX "AiRemediationReview_projectId_status_idx" ON "AiRemediationReview"("projectId", "status");
ALTER TABLE "AiRemediationReview" ADD CONSTRAINT "AiRemediationReview_analysisId_fkey" FOREIGN KEY ("analysisId") REFERENCES "AiAnalysis"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AiRemediationReview" ADD CONSTRAINT "AiRemediationReview_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
