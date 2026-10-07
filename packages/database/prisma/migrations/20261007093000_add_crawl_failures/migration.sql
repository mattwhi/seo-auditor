-- CreateTable
CREATE TABLE "CrawlFailure" (
    "id" TEXT NOT NULL,
    "auditId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "statusCode" INTEGER,
    "attempts" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CrawlFailure_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CrawlFailure_auditId_idx" ON "CrawlFailure"("auditId");

-- CreateIndex
CREATE INDEX "CrawlFailure_auditId_type_idx" ON "CrawlFailure"("auditId", "type");

-- CreateIndex
CREATE INDEX "CrawlFailure_statusCode_idx" ON "CrawlFailure"("statusCode");

-- AddForeignKey
ALTER TABLE "CrawlFailure" ADD CONSTRAINT "CrawlFailure_auditId_fkey" FOREIGN KEY ("auditId") REFERENCES "Audit"("id") ON DELETE CASCADE ON UPDATE CASCADE;
