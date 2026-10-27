'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import '../intelligence.css';

type Project = { id: string; name: string; baseUrl: string };
type Competitor = { id: string; domain: string; label: string | null; createdAt: string };
type Comparison = { id: string; competitor: string; keyword: string; position: number; ownPosition: number | null; gap: string; score: number; source: string; observedOn: string };
type SerpData = { comparisons: Comparison[]; observationCount: number; coverage: string; ownCoverage: string };
type ResponseData = { project: Project; competitors: Competitor[] };
export default function CompetitorIntelligence() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectId, setProjectId] = useState('');
  const [data, setData] = useState<ResponseData | null>(null);
  const [domain, setDomain] = useState('');
  const [label, setLabel] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(false);
  const [serp, setSerp] = useState<SerpData | null>(null);
  const [serpError, setSerpError] = useState('');
  const [csv, setCsv] = useState('');
  const [source, setSource] = useState('');
  const [importing, setImporting] = useState(false);
  const [filter, setFilter] = useState('all');
  async function loadSerp(id: string) { const r = await fetch(`/api/intelligence/serp?projectId=${encodeURIComponent(id)}`, { cache: 'no-store' }); const j = await r.json() as SerpData & { error?: string }; if (!r.ok) throw new Error(j.error || 'Unable to load SERP evidence'); setSerp(j); }
  async function importCsv() {
    setImporting(true); setSerpError('');
    try {
      // Simple comma-separated format: competitor domain,keyword,position,date,result URL (optional). Quoted commas are not supported.
      const lines = csv.trim().split(/\r?\n/).filter(Boolean);
      if (lines.length > 250) throw new Error('Maximum 250 rows per import');
      const observations = lines.map((line, i) => { const fields = line.split(',').map(s => s.trim()); const [domain, keyword, pos, observedOn, resultUrl] = fields; const competitor = data?.competitors.find(c => c.domain.replace(/^www\./,'') === domain?.replace(/^www\./,'')); if (!competitor) throw new Error(`Line ${i+1}: competitor domain is not on the watchlist`); return { competitorId: competitor.id, keyword, position: Number(pos), observedOn, source, ...(resultUrl ? { resultUrl } : {}) }; });
      const r = await fetch('/api/intelligence/serp', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ projectId, observations }) });
      const result = await r.json() as { error?: string }; if (!r.ok) throw new Error(result.error || 'Import failed'); setCsv(''); await loadSerp(projectId);
    } catch(e) { setSerpError(e instanceof Error ? e.message : 'Import failed'); } finally { setImporting(false); }
  }
  useEffect(() => {
    const controller = new AbortController();
    fetch('/api/backend/v1/projects', { signal: controller.signal, cache: 'no-store' })
      .then(async response => { if (!response.ok) throw new Error('Unable to load projects'); return response.json() as Promise<Project[]>; })
      .then(items => { if (!controller.signal.aborted) { setProjects(items); setProjectId(items[0]?.id ?? ''); } })
      .catch(err => { if (!controller.signal.aborted) setError(err instanceof Error ? err.message : 'Unable to load projects'); });
    return () => controller.abort();
  }, []);
  useEffect(() => {
    if (!projectId) { setData(null); return; }
    const controller = new AbortController();
    setLoading(true); setError(''); setData(null); setSerp(null); setSerpError('');
    void loadSerp(projectId).catch(e => setSerpError(e instanceof Error ? e.message : 'Unable to load SERP evidence'));
    fetch(`/api/intelligence/competitors?projectId=${encodeURIComponent(projectId)}`, { signal: controller.signal, cache: 'no-store' })
      .then(async response => { const result = await response.json() as ResponseData & { error?: string }; if (!response.ok) throw new Error(result.error ?? 'Unable to load competitors'); return result; })
      .then(result => { if (!controller.signal.aborted) setData(result); })
      .catch(err => { if (!controller.signal.aborted) setError(err instanceof Error ? err.message : 'Unable to load competitors'); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [projectId]);
  async function addCompetitor(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError('');
    try {
      const response = await fetch('/api/intelligence/competitors', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ projectId, domain, label }) });
      const result = await response.json() as { competitor?: Competitor; error?: string };
      if (!response.ok || !result.competitor) throw new Error(result.error ?? 'Unable to add competitor');
      setData(prev => prev ? { ...prev, competitors: [...prev.competitors, result.competitor!] } : prev);
      setDomain(''); setLabel('');
    } catch (err) { setError(err instanceof Error ? err.message : 'Unable to add competitor'); }
    finally { setBusy(false); }
  }
  async function removeCompetitor(id: string) {
    if (!window.confirm('Remove this competitor from tracking?')) return;
    setBusy(true); setError('');
    try {
      const response = await fetch('/api/intelligence/competitors', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ projectId, id }) });
      if (!response.ok) { const result = await response.json() as { error?: string }; throw new Error(result.error ?? 'Unable to remove competitor'); }
      setData(prev => prev ? { ...prev, competitors: prev.competitors.filter(item => item.id !== id) } : prev);
    } catch (err) { setError(err instanceof Error ? err.message : 'Unable to remove competitor'); }
    finally { setBusy(false); }
  }
  return <main className="intelligence-page competitor-page">
    <header className="intelligence-header"><span className="intelligence-eyebrow">SEO Auditor / Intelligence / v1.2.3</span><h1>Competitor intelligence</h1><p>Build a project-specific competitor watchlist. Tracking domains is not a claim about their rankings, traffic or shared keywords.</p><div className="competitor-links"><Link href="/intelligence">← Keyword opportunities</Link></div></header>
    <section className="intelligence-panel"><div className="intelligence-controls"><label>Project<select value={projectId} onChange={event => setProjectId(event.target.value)}>{projects.map(project => <option key={project.id} value={project.id}>{project.name} — {project.baseUrl}</option>)}</select></label></div></section>
    {error && <p className="intelligence-error" role="alert">{error}</p>}
    <div className="intelligence-stats"><div><span>Tracked competitors</span><strong>{data?.competitors.length ?? '—'}</strong></div><div><span>Selected project</span><strong className="competitor-stat-text">{data?.project.name ?? '—'}</strong></div><div><span>Comparison data</span><strong className="competitor-stat-text">{serp?.observationCount ? `${serp.observationCount} observations` : 'No SERP evidence'}</strong></div></div>
    <section className="intelligence-panel"><h2>Add a competitor</h2><p className="intelligence-muted">Enter a competitor domain (for example, example.co.uk). No scraping or network requests to competitor websites are performed.</p><form className="intelligence-controls competitor-form" onSubmit={event => void addCompetitor(event)}><label>Domain<input required maxLength={253} placeholder="example.co.uk" value={domain} onChange={event => setDomain(event.target.value)} /></label><label>Display name (optional)<input maxLength={120} placeholder="Competitor name" value={label} onChange={event => setLabel(event.target.value)} /></label><button disabled={busy || !projectId || !domain.trim()} type="submit">{busy ? 'Saving…' : 'Add competitor'}</button></form></section>
    <section className="intelligence-panel"><h2>Competitor watchlist</h2>{loading ? <p>Loading competitors…</p> : !data?.competitors.length ? <p className="intelligence-muted">No competitors tracked for this project yet. Add a domain above to start.</p> : <div className="intelligence-table-wrap"><table className="intelligence-table"><thead><tr><th>Competitor</th><th>Domain</th><th>Added</th><th>Evidence</th><th>Action</th></tr></thead><tbody>{data.competitors.map(item => <tr key={item.id}><td><strong>{item.label || item.domain}</strong></td><td><a href={`https://${item.domain}`} target="_blank" rel="noopener noreferrer">{item.domain}</a></td><td>{new Date(item.createdAt).toLocaleDateString('en-GB')}</td><td><span className="intelligence-confidence">Watchlist only</span></td><td><button type="button" className="competitor-remove" disabled={busy} onClick={() => void removeCompetitor(item.id)}>Remove</button></td></tr>)}</tbody></table></div>}</section>
    <section className="intelligence-panel"><h2>Competitor keyword comparisons</h2><p className="intelligence-muted">Rankings below come exclusively from explicitly imported, dated SERP observations. Own positions are from Google Search Console, which is an average rather than a matched live SERP. “Not observed” does not prove you do not rank. Scores are heuristic priorities, not search volume or difficulty metrics.</p>
    {serpError && <p className="intelligence-error" role="alert">{serpError}</p>}
    <div className="intelligence-filters"><label>Opportunity type<select value={filter} onChange={e=>setFilter(e.target.value)}><option value="all">All observations</option><option value="not_observed_in_gsc">Not observed in GSC</option><option value="competitor_ahead">Competitor ahead</option><option value="overlap">Keyword overlap</option></select></label></div>
    {serp?.coverage !== 'complete' || serp?.ownCoverage !== 'complete' ? <p className="intelligence-muted">Analysis uses the most recent 3,000 competitor and 5,000 own observations; results may be incomplete.</p> : null}
    {!serp?.comparisons.length ? <p className="intelligence-muted">No SERP observations imported yet. Add dated, sourced evidence below to enable comparisons.</p> : <div className="intelligence-table-wrap"><table className="intelligence-table"><thead><tr><th>Keyword</th><th>Competitor</th><th>Their position</th><th>Your GSC avg.</th><th>Assessment</th><th>Priority</th><th>Evidence</th></tr></thead><tbody>{serp.comparisons.filter(c=>filter==='all'||c.gap===filter).slice(0,100).map(c=><tr key={c.id}><td><strong>{c.keyword}</strong></td><td>{c.competitor}</td><td>{c.position}</td><td>{c.ownPosition===null?'Not observed':c.ownPosition.toFixed(1)}</td><td>{c.gap==='not_observed_in_gsc'?'Not observed in GSC':c.gap==='competitor_ahead'?'Competitor ahead':'Overlap'}</td><td><strong>{c.score}/100</strong></td><td><small>{c.source} · {new Date(c.observedOn).toLocaleDateString('en-GB')}</small></td></tr>)}</tbody></table></div>}
    </section>
    <section className="intelligence-panel"><h2>Import SERP observations</h2><p className="intelligence-muted">Import evidence from a licensed provider or manually verified SERP checks. Format: competitor domain,keyword,position,YYYY-MM-DD,optional result URL. One record per line; max 250. Plain CSV only (no quoted commas). Dates and source are required; no automated scraping occurs.</p><div className="intelligence-controls"><label>Evidence source<input value={source} onChange={e=>setSource(e.target.value)} placeholder="e.g. provider name / manual SERP check" maxLength={120}/></label></div><textarea className="competitor-csv" rows={6} value={csv} onChange={e=>setCsv(e.target.value)} placeholder="riley-co.co.uk,natural dog treats,5,2026-10-27" aria-label="SERP observation CSV"/><div className="intelligence-controls"><button type="button" disabled={importing||!source.trim()||!csv.trim()||!projectId} onClick={()=>void importCsv()}>{importing?'Importing…':'Import observations'}</button></div></section>
    <section className="intelligence-panel"><h2>Comparison readiness</h2><p className="intelligence-muted">Your own keyword performance is available in <Link href="/intelligence">Keyword Opportunities</Link>. Google Search Console only reports performance for verified properties; it cannot provide competitors’ private clicks, impressions or rankings. Cross-domain keyword gaps require an explicitly connected, licensed external dataset or other verified evidence.</p><div className="competitor-readiness"><div><strong>Available now</strong><span>Project-scoped watchlists and manual competitor identification</span></div><div><strong>Next integration</strong><span>Evidence-backed SERP or third-party keyword overlap, with source and observation dates</span></div></div></section>
  </main>;
}
