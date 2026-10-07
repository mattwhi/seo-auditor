'use client';

import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';

type Project = { id: string; name: string; baseUrl: string; createdAt: string };
type Audit = {
  id: string;
  projectId: string;
  status: string;
  score: number | null;
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
  _count?: { pages: number; issues: number };
};
type RuleSummary = { ruleId: string; severity: string; category: string; count: number };
type Summary = { total: number; bySeverity: Record<string, number>; byCategory: Record<string, number>; byRule: RuleSummary[] };
type PageRow = {
  id: string; url: string; finalUrl: string; statusCode: number; title: string | null;
  crawlDepth: number | null; responseTimeMs: number; _count: { issues: number };
};
type Issue = {
  id: string; ruleId: string; severity: string; category: string; message: string; evidence: unknown;
  page?: { url: string; finalUrl: string; statusCode: number } | null;
};

const api = '/api/backend/v1';
const activeStatuses = new Set(['queued', 'running', 'crawling', 'analysing']);

async function json<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, { ...init, cache: 'no-store', headers: { 'content-type': 'application/json', ...(init?.headers ?? {}) } });
  if (!response.ok) throw new Error(`Request failed (${response.status})`);
  return response.json() as Promise<T>;
}

export default function Home() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProject, setSelectedProject] = useState('');
  const [audits, setAudits] = useState<Audit[]>([]);
  const [selectedAudit, setSelectedAudit] = useState('');
  const [audit, setAudit] = useState<Audit | null>(null);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [pages, setPages] = useState<PageRow[]>([]);
  const [issues, setIssues] = useState<Issue[]>([]);
  const [name, setName] = useState('');
  const [baseUrl, setBaseUrl] = useState('https://');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const loadProjects = useCallback(async () => {
    const data = await json<Project[]>(`${api}/projects`);
    setProjects(data);
    setSelectedProject((current) => current || data[0]?.id || '');
  }, []);

  const loadAudits = useCallback(async (projectId: string) => {
    if (!projectId) return;
    const data = await json<Audit[]>(`${api}/projects/${projectId}/audits`);
    setAudits(data);
    setSelectedAudit((current) => data.some((item) => item.id === current) ? current : data[0]?.id || '');
  }, []);

  const loadAudit = useCallback(async (auditId: string) => {
    if (!auditId) { setAudit(null); return; }
    const [detail, findingSummary, pageData, issueData] = await Promise.all([
      json<Audit>(`${api}/audits/${auditId}`),
      json<Summary>(`${api}/audits/${auditId}/issues/summary`),
      json<{ items: PageRow[] }>(`${api}/audits/${auditId}/pages?limit=100`),
      json<{ items: Issue[] }>(`${api}/audits/${auditId}/issues?limit=100`),
    ]);
    setAudit(detail); setSummary(findingSummary); setPages(pageData.items); setIssues(issueData.items);
  }, []);

  useEffect(() => { loadProjects().catch((e: Error) => setError(e.message)); }, [loadProjects]);
  useEffect(() => { loadAudits(selectedProject).catch((e: Error) => setError(e.message)); }, [selectedProject, loadAudits]);
  useEffect(() => { loadAudit(selectedAudit).catch((e: Error) => setError(e.message)); }, [selectedAudit, loadAudit]);
  useEffect(() => {
    if (!selectedAudit || !audit || !activeStatuses.has(audit.status)) return;
    const timer = window.setInterval(() => loadAudit(selectedAudit).catch((e: Error) => setError(e.message)), 2500);
    return () => window.clearInterval(timer);
  }, [selectedAudit, audit, loadAudit]);

  async function createProject(event: FormEvent) {
    event.preventDefault(); setBusy(true); setError('');
    try {
      const project = await json<Project>(`${api}/projects`, { method: 'POST', body: JSON.stringify({ name, baseUrl }) });
      await loadProjects(); setSelectedProject(project.id); setName(''); setBaseUrl('https://');
    } catch (e) { setError(e instanceof Error ? e.message : 'Unable to create project'); } finally { setBusy(false); }
  }

  async function startAudit() {
    if (!selectedProject) return; setBusy(true); setError('');
    try {
      const created = await json<Audit>(`${api}/projects/${selectedProject}/audits`, { method: 'POST', body: '{}' });
      await loadAudits(selectedProject); setSelectedAudit(created.id); await loadAudit(created.id);
    } catch (e) { setError(e instanceof Error ? e.message : 'Unable to start audit'); } finally { setBusy(false); }
  }

  const project = projects.find((item) => item.id === selectedProject);
  const severities = ['critical', 'high', 'medium', 'low', 'info'];
  const scoreClass = useMemo(() => audit?.score == null ? '' : audit.score >= 80 ? 'good' : audit.score >= 50 ? 'warn' : 'bad', [audit?.score]);

  return <main>
    <header className="topbar"><div><span className="eyebrow">OPEN SOURCE · v0.3 DEVELOPMENT</span><h1>SEO Auditor</h1><p>Run deterministic technical SEO audits and inspect the evidence behind every finding.</p></div><div className="version">Slice 4</div></header>
    {error && <div className="alert">{error}</div>}

    <section className="workspace">
      <aside className="sidebar panel">
        <div className="section-title"><div><span className="eyebrow">PROJECTS</span><h2>Audit targets</h2></div></div>
        <div className="project-list">{projects.map((item) => <button key={item.id} className={item.id === selectedProject ? 'project active' : 'project'} onClick={() => setSelectedProject(item.id)}><strong>{item.name}</strong><span>{item.baseUrl}</span></button>)}</div>
        <form onSubmit={createProject} className="create-form"><h3>New project</h3><input required placeholder="Project name" value={name} onChange={(e) => setName(e.target.value)} /><input required type="url" placeholder="https://example.com" value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)} /><button className="primary" disabled={busy}>Create project</button></form>
      </aside>

      <div className="content">
        <section className="panel hero-panel"><div><span className="eyebrow">SELECTED PROJECT</span><h2>{project?.name ?? 'Create a project to begin'}</h2><p>{project?.baseUrl ?? 'Add a site and launch its first technical SEO audit.'}</p></div><button className="primary start" disabled={!selectedProject || busy} onClick={startAudit}>{busy ? 'Working…' : 'Start new audit'}</button></section>

        {audits.length > 0 && <section className="audit-strip"><label>Audit<select value={selectedAudit} onChange={(e) => setSelectedAudit(e.target.value)}>{audits.map((item) => <option key={item.id} value={item.id}>{new Date(item.createdAt).toLocaleString()} · {item.status}</option>)}</select></label><span className={`status ${audit?.status ?? ''}`}>{audit?.status ?? '—'}</span></section>}

        {audit ? <>
          <section className="metrics">
            <article><span>SEO score</span><strong className={scoreClass}>{audit.score ?? '—'}</strong></article>
            <article><span>Pages crawled</span><strong>{audit._count?.pages ?? pages.length}</strong></article>
            <article><span>Total findings</span><strong>{summary?.total ?? audit._count?.issues ?? 0}</strong></article>
            <article><span>Status</span><strong className="metric-status">{audit.status}</strong></article>
          </section>
          <section className="panel"><div className="section-title"><div><span className="eyebrow">SEVERITY</span><h2>Finding overview</h2></div></div><div className="severity-grid">{severities.map((severity) => <div key={severity} className={`severity-card ${severity}`}><span>{severity}</span><strong>{summary?.bySeverity[severity] ?? 0}</strong></div>)}</div></section>
          <section className="panel"><div className="section-title"><div><span className="eyebrow">RULES</span><h2>Issues by rule</h2></div><span>{summary?.byRule.length ?? 0} triggered rules</span></div><div className="table-wrap"><table><thead><tr><th>Rule</th><th>Category</th><th>Severity</th><th>Affected</th></tr></thead><tbody>{summary?.byRule.map((item) => <tr key={`${item.ruleId}-${item.severity}-${item.category}`}><td><code className="inline-code">{item.ruleId}</code></td><td>{item.category}</td><td><span className={`pill ${item.severity}`}>{item.severity}</span></td><td>{item.count}</td></tr>)}{!summary?.byRule.length && <tr><td colSpan={4} className="empty">No findings yet.</td></tr>}</tbody></table></div></section>
          <section className="panel"><div className="section-title"><div><span className="eyebrow">PAGES</span><h2>Crawl results</h2></div><span>First 100 pages</span></div><div className="table-wrap"><table><thead><tr><th>URL</th><th>Status</th><th>Depth</th><th>Title</th><th>Issues</th></tr></thead><tbody>{pages.map((page) => <tr key={page.id}><td className="url-cell" title={page.url}>{page.url}</td><td><span className={`http ${page.statusCode >= 400 ? 'bad' : page.statusCode >= 300 ? 'warn' : 'good'}`}>{page.statusCode}</span></td><td>{page.crawlDepth ?? '—'}</td><td className="title-cell">{page.title || <em>Missing</em>}</td><td>{page._count.issues}</td></tr>)}</tbody></table></div></section>
          <section className="panel"><div className="section-title"><div><span className="eyebrow">EVIDENCE</span><h2>Latest findings</h2></div><span>First 100 findings</span></div><div className="findings">{issues.map((issue) => <article key={issue.id} className="finding"><div className="finding-head"><span className={`pill ${issue.severity}`}>{issue.severity}</span><code className="inline-code">{issue.ruleId}</code></div><strong>{issue.message}</strong><span className="finding-url">{issue.page?.url ?? 'Audit-level finding'}</span>{issue.evidence != null && <pre>{JSON.stringify(issue.evidence, null, 2)}</pre>}</article>)}{issues.length === 0 && <p className="empty">No findings have been recorded for this audit.</p>}</div></section>
        </> : <section className="panel empty-state"><h2>No audit selected</h2><p>Create or select a project, then start an audit. Progress and findings will appear here.</p></section>}
      </div>
    </section>
  </main>;
}
