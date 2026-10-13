-- AlterTable
ALTER TABLE "Page" ALTER COLUMN "xRobotsTag" DROP DEFAULT;

-- CreateTable
CREATE TABLE "PerformanceResult" (
    "id" TEXT NOT NULL,
    "auditId" TEXT NOT NULL,
    "strategy" TEXT NOT NULL,
    "pageType" TEXT NOT NULL DEFAULT 'homepage',
    "url" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "measuredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lighthouseScore" INTEGER,
    "metrics" JSONB NOT NULL,
    "error" TEXT,

    CONSTRAINT "PerformanceResult_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RemediationProposal" (
    "id" TEXT NOT NULL,
    "auditId" TEXT NOT NULL,
    "issueId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "pageUrl" TEXT NOT NULL,
    "ruleId" TEXT NOT NULL,
    "targetType" TEXT NOT NULL,
    "targetId" INTEGER NOT NULL,
    "proposedText" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "approvedAt" TIMESTAMP(3),
    "rejectedAt" TIMESTAMP(3),

    CONSTRAINT "RemediationProposal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RemediationPreflight" (
    "id" TEXT NOT NULL,
    "proposalId" TEXT NOT NULL,
    "snapshotHash" TEXT NOT NULL,
    "adapter" TEXT NOT NULL,
    "field" TEXT NOT NULL,
    "originalValue" TEXT NOT NULL,
    "conflict" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RemediationPreflight_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RemediationExecution" (
    "id" TEXT NOT NULL,
    "proposalId" TEXT NOT NULL,
    "preflightId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "field" TEXT NOT NULL,
    "originalValue" TEXT NOT NULL,
    "appliedValue" TEXT NOT NULL,
    "snapshotHash" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "errorCode" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "executedAt" TIMESTAMP(3),
    "rolledBackAt" TIMESTAMP(3),

    CONSTRAINT "RemediationExecution_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PerformanceResult_auditId_idx" ON "PerformanceResult"("auditId");

-- CreateIndex
CREATE UNIQUE INDEX "PerformanceResult_auditId_strategy_url_key" ON "PerformanceResult"("auditId", "strategy", "url");

-- CreateIndex
CREATE INDEX "RemediationProposal_projectId_createdAt_idx" ON "RemediationProposal"("projectId", "createdAt");

-- CreateIndex
CREATE INDEX "RemediationProposal_auditId_issueId_idx" ON "RemediationProposal"("auditId", "issueId");

-- CreateIndex
CREATE INDEX "RemediationProposal_status_idx" ON "RemediationProposal"("status");

-- CreateIndex
CREATE INDEX "RemediationPreflight_proposalId_createdAt_idx" ON "RemediationPreflight"("proposalId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "RemediationExecution_proposalId_key" ON "RemediationExecution"("proposalId");

-- CreateIndex
CREATE INDEX "RemediationExecution_projectId_createdAt_idx" ON "RemediationExecution"("projectId", "createdAt");

-- CreateIndex
CREATE INDEX "RemediationExecution_status_idx" ON "RemediationExecution"("status");

-- AddForeignKey
ALTER TABLE "PerformanceResult" ADD CONSTRAINT "PerformanceResult_auditId_fkey" FOREIGN KEY ("auditId") REFERENCES "Audit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

