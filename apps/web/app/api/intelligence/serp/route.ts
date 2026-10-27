import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { db, currentUser, sameOrigin, canMutate } from '../../../../lib/auth';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const rowSchema = z.object({ competitorId: z.string().min(1), keyword: z.string().trim().min(2).max(180), position: z.number().int().min(1).max(100), resultUrl: z.string().url().max(2000).optional(), source: z.string().trim().min(3).max(120), observedOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) });
const payload = z.object({ projectId: z.string().min(1), observations: z.array(rowSchema).min(1).max(250) });
export async function GET(request: NextRequest) {
  if (!await currentUser(request)) return NextResponse.json({ error: 'login_required' }, { status: 401 });
  const projectId = request.nextUrl.searchParams.get('projectId');
  if (!projectId) return NextResponse.json({ error: 'project_required' }, { status: 400 });
  const project = await db.project.findUnique({ where: { id: projectId }, select: { id: true } });
  if (!project) return NextResponse.json({ error: 'project_not_found' }, { status: 404 });
  const [competitors, observations, own] = await Promise.all([
    db.intelligenceCompetitor.findMany({ where: { projectId }, select: { id: true, domain: true, label: true } }),
    db.intelligenceSerpObservation.findMany({ where: { projectId }, orderBy: [{ observedOn: 'desc' }, { createdAt: 'desc' }], take: 3000, select: { id: true, competitorId: true, keyword: true, position: true, source: true, observedOn: true, resultUrl: true } }),
    db.intelligenceKeywordObservation.findMany({ where: { projectId }, orderBy: [{ periodEnd: 'desc' }, { observedAt: 'desc' }], take: 5000, select: { query: true, position: true, impressions: true, periodEnd: true } }),
  ]);
  const ownMap = new Map<string, { position: number; impressions: number; date: Date }>();
  for (const item of own) { const key = item.query.toLowerCase().trim(); if (!ownMap.has(key)) ownMap.set(key, { position: item.position, impressions: item.impressions, date: item.periodEnd }); }
  const seen = new Set<string>();
  const comparisons = observations.filter(o => { const key = `${o.competitorId}:${o.keyword.toLowerCase().trim()}`; if (seen.has(key)) return false; seen.add(key); return true; }).map(o => {
    const ownData = ownMap.get(o.keyword.toLowerCase().trim());
    const gap = !ownData ? 'not_observed_in_gsc' : ownData.position > o.position + 3 ? 'competitor_ahead' : 'overlap';
    const score = Math.min(100, Math.round((gap === 'not_observed_in_gsc' ? 65 : gap === 'competitor_ahead' ? 55 : 20) + Math.max(0, 21 - o.position) + Math.min(15, Math.log10((ownData?.impressions ?? 0) + 1) * 4)));
    return { ...o, competitor: competitors.find(c => c.id === o.competitorId)?.label || competitors.find(c => c.id === o.competitorId)?.domain || 'Unknown', ownPosition: ownData?.position ?? null, ownImpressions: ownData?.impressions ?? null, ownPeriodEnd: ownData?.date ?? null, gap, score };
  }).sort((a,b) => b.score - a.score);
  return NextResponse.json({ comparisons, observationCount: observations.length, coverage: observations.length === 3000 ? 'limited_to_latest_3000' : 'complete', ownCoverage: own.length === 5000 ? 'limited_to_latest_5000' : 'complete' }, { headers: { 'Cache-Control': 'no-store' } });
}
export async function POST(request: NextRequest) {
  const user = await currentUser(request);
  if (!user) return NextResponse.json({ error: 'login_required' }, { status: 401 });
  if (!sameOrigin(request) || !canMutate(user.role)) return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  const parsed = payload.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'invalid_observations', details: parsed.error.issues.slice(0, 3) }, { status: 400 });
  const { projectId, observations } = parsed.data;
  const valid = await db.intelligenceCompetitor.findMany({ where: { projectId, id: { in: observations.map(o => o.competitorId) } }, select: { id: true, domain: true } });
  if (new Set(observations.map(o => o.competitorId)).size !== valid.length) return NextResponse.json({ error: 'invalid_competitor_for_project' }, { status: 400 });
  const today = new Date().toISOString().slice(0, 10);
  for (const o of observations) {
    const date = new Date(`${o.observedOn}T00:00:00.000Z`);
    if (Number.isNaN(date.getTime()) || date.toISOString().slice(0,10) !== o.observedOn || o.observedOn > today) return NextResponse.json({ error: 'invalid_observation_date' }, { status: 400 });
    if (o.resultUrl) { try { const u = new URL(o.resultUrl); const domain = valid.find(c => c.id === o.competitorId)!.domain.replace(/^www\./,''); if (!['http:','https:'].includes(u.protocol) || u.hostname.replace(/^www\./,'') !== domain) return NextResponse.json({ error: 'result_url_domain_mismatch' }, { status: 400 }); } catch { return NextResponse.json({ error: 'invalid_result_url' }, { status: 400 }); } }
  }
  let saved = 0;
  for (const o of observations) {
    await db.intelligenceSerpObservation.upsert({ where: { projectId_competitorId_keyword_source_observedOn: { projectId, competitorId: o.competitorId, keyword: o.keyword.toLowerCase().trim(), source: o.source, observedOn: new Date(`${o.observedOn}T00:00:00.000Z`) } }, create: { projectId, competitorId: o.competitorId, keyword: o.keyword.toLowerCase().trim(), position: o.position, source: o.source, observedOn: new Date(`${o.observedOn}T00:00:00.000Z`), resultUrl: o.resultUrl }, update: { position: o.position, resultUrl: o.resultUrl } }); saved++;
  }
  return NextResponse.json({ saved });
}
