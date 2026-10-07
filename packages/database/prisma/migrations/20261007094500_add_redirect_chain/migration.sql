ALTER TABLE "Page" ADD COLUMN "redirectChain" JSONB;
ALTER TABLE "CrawlFailure" ADD COLUMN "redirectChain" JSONB;
