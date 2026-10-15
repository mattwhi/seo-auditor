CREATE TABLE "ProjectIntegration" (
  "projectId" TEXT NOT NULL PRIMARY KEY,
  "wordpressEnabled" BOOLEAN NOT NULL DEFAULT false,
  "wordpressSiteUrl" TEXT,
  "searchConsoleSiteUrl" TEXT,
  "ga4PropertyId" TEXT,
  "updatedById" TEXT NOT NULL,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE "ProjectIntegration" ADD CONSTRAINT "ProjectIntegration_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
