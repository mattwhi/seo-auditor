'use client';

import { useEffect, useState } from 'react';
import './intelligence.css';

type Project = { id: string; name: string; baseUrl: string };
type Opportunity = { id: string; query: string; pageUrl: string; clicks: number; impressions: number; ctr: number; position: number; score: number; kind: 'low_ctr' | 'striking_distance' };
type Report = { startDate: string; endDate: string; property: string; observationCount: number; opportunities: Opportunity[]; note: string };
function isoDate(daysAgo: number) { const d = new Date(); d.setUTCDate(d.getUTCDate() - daysAgo); return d.toISOString().slice(0, 10); }
export default function IntelligencePage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectId, setProjectId] = useState('');
  const [startDate, setStartDate] = useState(() => isoDate(30));
  const [endDate, setEndDate] = useState(() => isoDate(3));
  const [report, setReport] = useState<Report | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    fetch('/api/backend/v1/projects', { cache: 'no-store', signal: controller.signal })
      .then(async (r) => { if (!r.ok) throw new Error('Unable to load projects'); return r.json() as Promise<Project[]>; })
      .then((rows) => { if (!controller.signal.aborted) { setProjects(rows); setProjectId(rows[0]?.id ?? ''); } })
      .catch((e: unknown) => { if (!controller.signal.aborted) setError(e instanceof Error ? e.message : 'Unable to load projects'); });
    return () => controller.abort();
  }, []);
  async function analyse() {
    if (!projectId) return;
    setError(''); setReport(null); setLoading(true);
    try {
      const params = new URLSearchParams({ startDate, endDate });
      const response = await fetch(`/api/backend/v1/projects/${encodeURIComponent(projectId)}/intelligence/keyword-opportunities?${params}`, { cache: 'no-store' });
      const data = await response.json() as Report & { error?: string };
      if (!response.ok) throw new Error(data.error === 'search_console_not_configured' ? 'Configure a Search Console property in Integrations first.' : data.error === 'google_credentials_missing' ? 'Configure Google credentials in Integrations first.' : data.error ?? `Analysis failed (${response.status})`);
      setReport(data);
    } catch (e: unknown) { setError(e instanceof Error ? e.message : 'Analysis failed'); }
    finally { setLoading(false); }
  }
  return <main className="intelligence-page">
    <header className="intelligence-header"><span className="intelligence-eyebrow">SEO Auditor / Intelligence / v1.2.1</span><h1>Keyword opportunities</h1><p>Discover low-click-through-rate and striking-distance opportunities from your own Google Search Console data. Recommendations only — no automatic changes.</p></header>
    <section className="intelligence-panel" aria-label="Analysis settings"><div className="intelligence-controls">
      <label>Project<select value={projectId} onChange={e => { setProjectId(e.target.value); setReport(null); }}>{projects.map(p => <option key={p.id} value={p.id}>{p.name} — {p.baseUrl}</option>)}</select></label>
      <label>From<input type="date" value={startDate} max={endDate} onChange={e => setStartDate(e.target.value)} /></label>
      <label>To<input type="date" value={endDate} min={startDate} max={isoDate(1)} onChange={e => setEndDate(e.target.value)} /></label>
      <button type="button" disabled={loading || !projectId || !startDate || !endDate || startDate > endDate} onClick={() => void analyse()}>{loading ? 'Analysing…' : 'Analyse Search Console'}</button>
    </div></section>
    {error && <p className="intelligence-error" role="alert">{error} <a href="/admin/integrations">Integration settings</a></p>}
    {!report && !error && <section className="intelligence-panel intelligence-empty"><h2>Ready to analyse</h2><p>Select a project and date range, then run the analysis. No database migration or sync is required.</p></section>}
    {report && <><div className="intelligence-stats"><div><span>Opportunities</span><strong>{report.opportunities.length}</strong></div><div><span>GSC rows examined</span><strong>{report.observationCount.toLocaleString()}</strong></div><div><span>Search property</span><strong className="intelligence-property">{report.property}</strong></div></div>
      <section className="intelligence-panel"><h2>Prioritised keyword opportunities</h2><p className="intelligence-muted">{report.startDate} to {report.endDate} · Ranked using impact, confidence and estimated effort.</p>
      <div className="intelligence-table-wrap"><table><thead><tr><th>Keyword / page</th><th>Type</th><th>Clicks</th><th>Impressions</th><th>CTR</th><th>Position</th><th>Priority</th></tr></thead><tbody>{report.opportunities.map(o => <tr key={o.id}><td><strong>{o.query}</strong><a href={o.pageUrl} target="_blank" rel="noopener noreferrer">{o.pageUrl}</a></td><td>{o.kind === 'low_ctr' ? 'Low CTR' : 'Striking distance'}</td><td>{o.clicks.toLocaleString()}</td><td>{o.impressions.toLocaleString()}</td><td>{(o.ctr * 100).toFixed(2)}%</td><td>{o.position.toFixed(1)}</td><td><span className="intelligence-score">{o.score}/100</span></td></tr>)}</tbody></table></div>
      {report.opportunities.length === 0 && <p className="intelligence-muted">No candidates meet the current thresholds (100+ impressions, positions 3–20, CTR below 2%). Try a wider date range.</p>}
      <p className="intelligence-muted">{report.note}</p></section></>}
  </main>;
}
