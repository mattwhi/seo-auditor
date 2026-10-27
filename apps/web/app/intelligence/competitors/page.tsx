'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import '../intelligence.css';

type Project = { id: string; name: string; baseUrl: string };
type Competitor = { id: string; domain: string; label: string | null; createdAt: string };
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
    setLoading(true); setError(''); setData(null);
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
    <header className="intelligence-header"><span className="intelligence-eyebrow">SEO Auditor / Intelligence / v1.2.2</span><h1>Competitor intelligence</h1><p>Build a project-specific competitor watchlist. Tracking domains is not a claim about their rankings, traffic or shared keywords.</p><div className="competitor-links"><Link href="/intelligence">← Keyword opportunities</Link></div></header>
    <section className="intelligence-panel"><div className="intelligence-controls"><label>Project<select value={projectId} onChange={event => setProjectId(event.target.value)}>{projects.map(project => <option key={project.id} value={project.id}>{project.name} — {project.baseUrl}</option>)}</select></label></div></section>
    {error && <p className="intelligence-error" role="alert">{error}</p>}
    <div className="intelligence-stats"><div><span>Tracked competitors</span><strong>{data?.competitors.length ?? '—'}</strong></div><div><span>Selected project</span><strong className="competitor-stat-text">{data?.project.name ?? '—'}</strong></div><div><span>Comparison data</span><strong className="competitor-stat-text">Not connected</strong></div></div>
    <section className="intelligence-panel"><h2>Add a competitor</h2><p className="intelligence-muted">Enter a competitor domain (for example, example.co.uk). No scraping or network requests to competitor websites are performed.</p><form className="intelligence-controls competitor-form" onSubmit={event => void addCompetitor(event)}><label>Domain<input required maxLength={253} placeholder="example.co.uk" value={domain} onChange={event => setDomain(event.target.value)} /></label><label>Display name (optional)<input maxLength={120} placeholder="Competitor name" value={label} onChange={event => setLabel(event.target.value)} /></label><button disabled={busy || !projectId || !domain.trim()} type="submit">{busy ? 'Saving…' : 'Add competitor'}</button></form></section>
    <section className="intelligence-panel"><h2>Competitor watchlist</h2>{loading ? <p>Loading competitors…</p> : !data?.competitors.length ? <p className="intelligence-muted">No competitors tracked for this project yet. Add a domain above to start.</p> : <div className="intelligence-table-wrap"><table className="intelligence-table"><thead><tr><th>Competitor</th><th>Domain</th><th>Added</th><th>Evidence</th><th>Action</th></tr></thead><tbody>{data.competitors.map(item => <tr key={item.id}><td><strong>{item.label || item.domain}</strong></td><td><a href={`https://${item.domain}`} target="_blank" rel="noopener noreferrer">{item.domain}</a></td><td>{new Date(item.createdAt).toLocaleDateString('en-GB')}</td><td><span className="intelligence-confidence">Watchlist only</span></td><td><button type="button" className="competitor-remove" disabled={busy} onClick={() => void removeCompetitor(item.id)}>Remove</button></td></tr>)}</tbody></table></div>}</section>
    <section className="intelligence-panel"><h2>Comparison readiness</h2><p className="intelligence-muted">Your own keyword performance is available in <Link href="/intelligence">Keyword Opportunities</Link>. Google Search Console only reports performance for verified properties; it cannot provide competitors’ private clicks, impressions or rankings. Cross-domain keyword gaps require an explicitly connected, licensed external dataset or other verified evidence.</p><div className="competitor-readiness"><div><strong>Available now</strong><span>Project-scoped watchlists and manual competitor identification</span></div><div><strong>Next integration</strong><span>Evidence-backed SERP or third-party keyword overlap, with source and observation dates</span></div></div></section>
  </main>;
}
