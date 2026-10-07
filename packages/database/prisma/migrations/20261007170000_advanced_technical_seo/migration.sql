ALTER TABLE "Page"
  ADD COLUMN "images" JSONB,
  ADD COLUMN "outgoingLinks" JSONB,
  ADD COLUMN "hreflang" JSONB,
  ADD COLUMN "jsonLdBlocks" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "jsonLdErrors" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "contentHash" TEXT;

CREATE INDEX "Page_auditId_crawlDepth_idx" ON "Page"("auditId", "crawlDepth");
CREATE INDEX "Page_auditId_contentHash_idx" ON "Page"("auditId", "contentHash");
