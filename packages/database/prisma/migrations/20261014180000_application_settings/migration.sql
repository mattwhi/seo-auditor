CREATE TABLE "ApplicationSetting" (
 "key" TEXT NOT NULL,
 "value" JSONB NOT NULL,
 "updatedById" TEXT NOT NULL,
 "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT "ApplicationSetting_pkey" PRIMARY KEY ("key")
);
