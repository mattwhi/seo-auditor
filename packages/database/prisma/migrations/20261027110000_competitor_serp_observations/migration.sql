-- Additive v1.2.3: sourced competitor SERP observations.
CREATE TABLE "IntelligenceSerpObservation" (
 "id" TEXT NOT NULL,
 "projectId" TEXT NOT NULL,
 "competitorId" TEXT NOT NULL,
 "keyword" TEXT NOT NULL,
 "position" INTEGER NOT NULL,
 "resultUrl" TEXT,
 "source" TEXT NOT NULL,
 "observedOn" DATE NOT NULL,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT "IntelligenceSerpObservation_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "IntelligenceSerpObservation_projectId_competitorId_keyword_source_observedOn_key" ON "IntelligenceSerpObservation"("projectId","competitorId","keyword","source","observedOn");
CREATE INDEX "IntelligenceSerpObservation_projectId_keyword_idx" ON "IntelligenceSerpObservation"("projectId","keyword");
CREATE INDEX "IntelligenceSerpObservation_competitorId_observedOn_idx" ON "IntelligenceSerpObservation"("competitorId","observedOn");
ALTER TABLE "IntelligenceSerpObservation" ADD CONSTRAINT "IntelligenceSerpObservation_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "IntelligenceSerpObservation" ADD CONSTRAINT "IntelligenceSerpObservation_competitorId_fkey" FOREIGN KEY ("competitorId") REFERENCES "IntelligenceCompetitor"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "IntelligenceSerpObservation" ADD CONSTRAINT "IntelligenceSerpObservation_position_check" CHECK ("position" BETWEEN 1 AND 100);
