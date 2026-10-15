ALTER TABLE "DashboardAdminEvent" ADD COLUMN IF NOT EXISTS "archivedAt" TIMESTAMP(3);
CREATE INDEX IF NOT EXISTS "DashboardAdminEvent_archivedAt_createdAt_idx" ON "DashboardAdminEvent"("archivedAt", "createdAt");
