ALTER TABLE "DashboardInvitation" ADD COLUMN "revokedAt" TIMESTAMP(3);
CREATE TABLE "DashboardAdminEvent" (
  "id" TEXT NOT NULL,
  "actorId" TEXT NOT NULL,
  "action" TEXT NOT NULL,
  "targetId" TEXT NOT NULL,
  "details" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "DashboardAdminEvent_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "DashboardAdminEvent_createdAt_idx" ON "DashboardAdminEvent"("createdAt");
CREATE INDEX "DashboardAdminEvent_targetId_createdAt_idx" ON "DashboardAdminEvent"("targetId", "createdAt");
ALTER TABLE "DashboardAdminEvent" ADD CONSTRAINT "DashboardAdminEvent_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "DashboardUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
