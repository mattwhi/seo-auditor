CREATE TABLE "WordPressCredential" (
    "projectId" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "encryptedPassword" TEXT NOT NULL,
    "updatedById" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "WordPressCredential_pkey" PRIMARY KEY ("projectId")
);
