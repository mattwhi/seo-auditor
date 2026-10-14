-- Reconcile existing installations with the required Prisma schema.
-- Existing NULL values must be checked before deployment.
ALTER TABLE "Page"
ALTER COLUMN "xRobotsTag" SET NOT NULL;
