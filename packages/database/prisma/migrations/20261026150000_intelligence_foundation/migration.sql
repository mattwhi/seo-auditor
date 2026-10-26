-- v1.2.0 additive intelligence foundation. REVIEW before manual deployment.
CREATE TABLE "IntelligenceCompetitor" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "domain" TEXT NOT NULL,
    "label" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "IntelligenceCompetitor_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "IntelligenceKeywordObservation" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "query" TEXT NOT NULL,
    "pageUrl" TEXT NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'search_console',
    "periodStart" DATE NOT NULL,
    "periodEnd" DATE NOT NULL,
    "clicks" INTEGER NOT NULL,
    "impressions" INTEGER NOT NULL,
    "ctr" DOUBLE PRECISION NOT NULL,
    "position" DOUBLE PRECISION NOT NULL,
    "observedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "IntelligenceKeywordObservation_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "IntelligenceOpportunity" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'open',
    "pageUrl" TEXT,
    "keyword" TEXT,
    "title" TEXT NOT NULL,
    "rationale" TEXT NOT NULL,
    "evidence" JSONB NOT NULL,
    "evidenceSource" TEXT NOT NULL,
    "impact" INTEGER NOT NULL,
    "confidence" INTEGER NOT NULL,
    "effort" INTEGER NOT NULL,
    "score" INTEGER NOT NULL,
    "fingerprint" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "IntelligenceOpportunity_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "IntelligenceCompetitor_projectId_domain_key" ON "IntelligenceCompetitor" ("projectId", "domain");

CREATE INDEX "IntelligenceCompetitor_projectId_createdAt_idx" ON "IntelligenceCompetitor" ("projectId", "createdAt");

CREATE UNIQUE INDEX "IntelligenceKeywordObservation_projectId_source_query_pageU_key" ON "IntelligenceKeywordObservation" (
    "projectId",
    "source",
    "query",
    "pageUrl",
    "periodStart",
    "periodEnd"
);

CREATE INDEX "IntelligenceKeywordObservation_projectId_periodEnd_idx" ON "IntelligenceKeywordObservation" ("projectId", "periodEnd");

CREATE INDEX "IntelligenceKeywordObservation_projectId_pageUrl_idx" ON "IntelligenceKeywordObservation" ("projectId", "pageUrl");

CREATE UNIQUE INDEX "IntelligenceOpportunity_projectId_fingerprint_key" ON "IntelligenceOpportunity" ("projectId", "fingerprint");

CREATE INDEX "IntelligenceOpportunity_projectId_status_score_idx" ON "IntelligenceOpportunity" (
    "projectId",
    "status",
    "score"
);

CREATE INDEX "IntelligenceOpportunity_projectId_kind_idx" ON "IntelligenceOpportunity" ("projectId", "kind");

ALTER TABLE "IntelligenceCompetitor"
ADD CONSTRAINT "IntelligenceCompetitor_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "IntelligenceKeywordObservation"
ADD CONSTRAINT "IntelligenceKeywordObservation_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "IntelligenceOpportunity"
ADD CONSTRAINT "IntelligenceOpportunity_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE;