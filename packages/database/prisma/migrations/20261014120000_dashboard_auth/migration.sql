CREATE TABLE "DashboardUser" (
 "id" TEXT NOT NULL, "email" TEXT NOT NULL, "passwordHash" TEXT NOT NULL,
 "role" TEXT NOT NULL DEFAULT 'READ_ONLY', "disabled" BOOLEAN NOT NULL DEFAULT false,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT "DashboardUser_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "DashboardUser_email_key" ON "DashboardUser"("email");
CREATE TABLE "DashboardSession" (
 "id" TEXT NOT NULL, "tokenHash" TEXT NOT NULL, "userId" TEXT NOT NULL,
 "expiresAt" TIMESTAMP(3) NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT "DashboardSession_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "DashboardSession_tokenHash_key" ON "DashboardSession"("tokenHash");
CREATE INDEX "DashboardSession_userId_idx" ON "DashboardSession"("userId");
CREATE INDEX "DashboardSession_expiresAt_idx" ON "DashboardSession"("expiresAt");
ALTER TABLE "DashboardSession" ADD CONSTRAINT "DashboardSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "DashboardUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;
CREATE TABLE "DashboardInvitation" (
 "id" TEXT NOT NULL, "email" TEXT NOT NULL, "role" TEXT NOT NULL DEFAULT 'READ_ONLY',
 "tokenHash" TEXT NOT NULL, "invitedById" TEXT NOT NULL, "expiresAt" TIMESTAMP(3) NOT NULL,
 "acceptedAt" TIMESTAMP(3), "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT "DashboardInvitation_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "DashboardInvitation_tokenHash_key" ON "DashboardInvitation"("tokenHash");
CREATE INDEX "DashboardInvitation_email_idx" ON "DashboardInvitation"("email");
CREATE INDEX "DashboardInvitation_expiresAt_idx" ON "DashboardInvitation"("expiresAt");
ALTER TABLE "DashboardInvitation" ADD CONSTRAINT "DashboardInvitation_invitedById_fkey" FOREIGN KEY ("invitedById") REFERENCES "DashboardUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
