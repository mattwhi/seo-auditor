ALTER TABLE "Page"
ADD COLUMN "contentType" TEXT,
ADD COLUMN "contentLength" INTEGER,
ADD COLUMN "contentEncoding" TEXT,
ADD COLUMN "contentLanguage" TEXT,
ADD COLUMN "cacheControl" TEXT,
ADD COLUMN "etag" TEXT,
ADD COLUMN "lastModified" TEXT,
ADD COLUMN "xRobotsTag" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
ADD COLUMN "crawlDepth" INTEGER,
ADD COLUMN "redirectCount" INTEGER,
ADD COLUMN "fetchAttempts" INTEGER;
