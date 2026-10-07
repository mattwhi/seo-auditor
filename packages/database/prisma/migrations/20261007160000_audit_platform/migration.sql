ALTER TABLE "Project" ADD COLUMN "retentionDays" INTEGER NOT NULL DEFAULT 90;
ALTER TABLE "Audit" ADD COLUMN "trigger" TEXT NOT NULL DEFAULT 'manual';
ALTER TABLE "Audit" ADD COLUMN "cancelRequested" BOOLEAN NOT NULL DEFAULT false;
CREATE INDEX "Audit_projectId_createdAt_idx" ON "Audit"("projectId", "createdAt");
CREATE TABLE "AuditSchedule" (
  "id" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "enabled" BOOLEAN NOT NULL DEFAULT false,
  "frequency" TEXT NOT NULL DEFAULT 'weekly',
  "hourUtc" INTEGER NOT NULL DEFAULT 3,
  "dayOfWeek" INTEGER,
  "dayOfMonth" INTEGER,
  "nextRunAt" TIMESTAMP(3),
  "lastRunAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AuditSchedule_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "AuditSchedule_projectId_key" ON "AuditSchedule"("projectId");
CREATE INDEX "AuditSchedule_enabled_nextRunAt_idx" ON "AuditSchedule"("enabled", "nextRunAt");
ALTER TABLE "AuditSchedule" ADD CONSTRAINT "AuditSchedule_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
