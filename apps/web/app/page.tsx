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
  _count?: { pages: number; issues: number; crawlFailures: number };
};
type RuleSummary = { ruleId: string; severity: string; category: string; count: number };
type Summary = {
  total: number;
  bySeverity: Record<string, number>;
  byCategory: Record<string, number>;
  byRule: RuleSummary[];
};
type PageRow = {
  id: string;
  url: string;
  finalUrl: string;
  statusCode: number;
  title: string | null;
  crawlDepth: number | null;
  responseTimeMs: number;
  _count: { issues: number };
};
type CrawlFailure = {
  id: string;
  url: string;
  type: string;
  message: string;
  statusCode: number | null;
  attempts: number;
  createdAt: string;
};
type View = 'overview' | 'issues' | 'pages' | 'failures';

const api = '/api/backend/v1';
const activeStatuses = new Set(['queued', 'running', 'crawling', 'analysing']);
const severities = ['critical', 'high', 'medium', 'low', 'info'];
const severityRank: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3, info: 4 };

const ruleNames: Record<string, string> = {
  'indexability.canonical-non-self': 'Canonical points to another URL',
  'indexability.canonical-missing': 'Canonical is missing',
  'indexability.noindex': 'Page is marked noindex',
  'indexability.x-robots-noindex': 'X-Robots-Tag prevents indexing',
  'crawlability.http-4xx': 'Client error (4xx)',
  'crawlability.http-5xx': 'Server error (5xx)',
  'crawlability.redirect': 'URL redirects',
  'crawlability.redirect-chain': 'Redirect chain detected',
  'metadata.title-missing': 'Page title is missing',
  'metadata.title-short': 'Page title is short',
  'metadata.title-long': 'Page title is long',
  'metadata.description-missing': 'Meta description is missing',
  'metadata.description-short': 'Meta description is short',
  'metadata.description-long': 'Meta description is long',
  'headings.h1-missing': 'H1 heading is missing',
  'headings.h1-empty': 'H1 heading is empty',
};

async function json<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    cache: 'no-store',
    headers: { 'content-type': 'application/json', ...(init?.headers ?? {}) },
  });
  if (!response.ok) throw new Error(`Request failed (${response.status})`);
  return response.json() as Promise<T>;
}

function ruleName(ruleId: string) {
  return ruleNames[ruleId] ?? ruleId.split('.').at(-1)?.replaceAll('-', ' ') ?? ruleId;
}

export default function Home() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProject, setSelectedProject] = useState('');
  const [audits, setAudits] = useState<Audit[]>([]);
  const [selectedAudit, setSelectedAudit] = useState('');
  const [audit, setAudit] = useState<Audit | null>(null);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [pages, setPages] = useState<PageRow[]>([]);
  const [failures, setFailures] = useState<CrawlFailure[]>([]);
  const [failureTotal, setFailureTotal] = useState(0);
  const [view, setView] = useState<View>('overview');
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
    setSelectedAudit((current) =>
      data.some((item) => item.id === current) ? current : data[0]?.id || '',
    );
  }, []);

  const loadAudit = useCallback(async (auditId: string) => {
    if (!auditId) {
      setAudit(null);
      return;
    }
    const [detail, findingSummary, pageData, failureData] = await Promise.all([
      json<Audit>(`${api}/audits/${auditId}`),
      json<Summary>(`${api}/audits/${auditId}/issues/summary`),
      json<{ items: PageRow[] }>(`${api}/audits/${auditId}/pages?limit=100`),
      json<{ items: CrawlFailure[]; total: number }>(`${api}/audits/${auditId}/failures?limit=100`),
    ]);
    setAudit(detail);
    setSummary(findingSummary);
    setPages(pageData.items);
    setFailures(failureData.items);
    setFailureTotal(failureData.total);
  }, []);

  useEffect(() => {
    loadProjects().catch((e: Error) => setError(e.message));
  }, [loadProjects]);
  useEffect(() => {
    loadAudits(selectedProject).catch((e: Error) => setError(e.message));
  }, [selectedProject, loadAudits]);
  useEffect(() => {
    setView('overview');
    loadAudit(selectedAudit).catch((e: Error) => setError(e.message));
  }, [selectedAudit, loadAudit]);
  useEffect(() => {
    if (!selectedAudit || !audit || !activeStatuses.has(audit.status)) return;
    const timer = window.setInterval(
      () => loadAudit(selectedAudit).catch((e: Error) => setError(e.message)),
      2500,
    );
    return () => window.clearInterval(timer);
  }, [selectedAudit, audit, loadAudit]);

  async function createProject(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      const project = await json<Project>(`${api}/projects`, {
        method: 'POST',
        body: JSON.stringify({ name, baseUrl }),
      });
      await loadProjects();
      setSelectedProject(project.id);
      setName('');
      setBaseUrl('https://');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to create project');
    } finally {
      setBusy(false);
    }
  }

  async function startAudit() {
    if (!selectedProject) return;
    setBusy(true);
    setError('');
    try {
      const created = await json<Audit>(`${api}/projects/${selectedProject}/audits`, {
        method: 'POST',
        body: '{}',
      });
      await loadAudits(selectedProject);
      setSelectedAudit(created.id);
      await loadAudit(created.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to start audit');
    } finally {
      setBusy(false);
    }
  }

  const project = projects.find((item) => item.id === selectedProject);
  const scoreClass = useMemo(
    () => (audit?.score == null ? '' : audit.score >= 80 ? 'good' : audit.score >= 50 ? 'warn' : 'bad'),
    [audit?.score],
  );
  const sortedRules = useMemo(
    () =>
      [...(summary?.byRule ?? [])].sort(
        (a, b) =>
          (severityRank[a.severity] ?? 99) - (severityRank[b.severity] ?? 99) ||
          b.count - a.count ||
          a.ruleId.localeCompare(b.ruleId),
      ),
    [summary],
  );
  const actionable = severities.slice(0, 4).reduce((total, severity) => total + (summary?.bySeverity[severity] ?? 0), 0);

  return (
    <main>
      <header className="topbar">
        <div>
          <span className="eyebrow">OPEN SOURCE · v0.3 DEVELOPMENT</span>
          <h1>SEO Auditor</h1>
          <p>Run deterministic technical SEO audits and inspect the evidence behind every finding.</p>
        </div>
        <div className="version">Slice 5A</div>
      </header>
      {error && <div className="alert">{error}</div>}

      <section className="workspace">
        <aside className="sidebar panel">
          <div className="section-title">
            <div><span className="eyebrow">PROJECTS</span><h2>Audit targets</h2></div>
          </div>
          <div className="project-list">
            {projects.map((item) => (
              <button key={item.id} className={item.id === selectedProject ? 'project active' : 'project'} onClick={() => setSelectedProject(item.id)}>
                <strong>{item.name}</strong><span>{item.baseUrl}</span>
              </button>
            ))}
          </div>
          <form onSubmit={createProject} className="create-form">
            <h3>New project</h3>
            <input required placeholder="Project name" value={name} onChange={(e) => setName(e.target.value)} />
            <input required type="url" placeholder="https://example.com" value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)} />
            <button className="primary" disabled={busy}>Create project</button>
          </form>
        </aside>

        <div className="content">
          <section className="panel hero-panel">
            <div><span className="eyebrow">SELECTED PROJECT</span><h2>{project?.name ?? 'Create a project to begin'}</h2><p>{project?.baseUrl ?? 'Add a site and launch its first technical SEO audit.'}</p></div>
            <button className="primary start" disabled={!selectedProject || busy} onClick={startAudit}>{busy ? 'Working…' : 'Start new audit'}</button>
          </section>

          {audits.length > 0 && (
            <section className="audit-strip">
              <label>Audit<select value={selectedAudit} onChange={(e) => setSelectedAudit(e.target.value)}>{audits.map((item) => <option key={item.id} value={item.id}>{new Date(item.createdAt).toLocaleString()} · {item.status}</option>)}</select></label>
              <span className={`status ${audit?.status ?? ''}`}>{audit?.status ?? '—'}</span>
            </section>
          )}

          {audit ? (
            <>
              <nav className="view-tabs" aria-label="Audit results">
                {(['overview', 'issues', 'pages', 'failures'] as View[]).map((item) => (
                  <button key={item} className={view === item ? 'view-tab active' : 'view-tab'} onClick={() => setView(item)}>
                    {item === 'failures' ? 'Crawl failures' : item}
                    {item === 'issues' && <span>{summary?.byRule.length ?? 0}</span>}
                    {item === 'pages' && <span>{audit._count?.pages ?? pages.length}</span>}
                    {item === 'failures' && <span>{failureTotal}</span>}
                  </button>
                ))}
              </nav>

              {view === 'overview' && (
                <>
                  <section className="metrics">
                    <article><span>SEO score</span><strong className={scoreClass}>{audit.score ?? '—'}</strong></article>
                    <article><span>Pages crawled</span><strong>{audit._count?.pages ?? pages.length}</strong></article>
                    <article><span>Actionable findings</span><strong>{actionable}</strong><small>{summary?.bySeverity.info ?? 0} informational</small></article>
                    <article><span>Status</span><strong className="metric-status">{audit.status}</strong></article>
                  </section>
                  <section className="panel">
                    <div className="section-title"><div><span className="eyebrow">SEVERITY</span><h2>Finding overview</h2></div><span>{summary?.total ?? 0} total findings</span></div>
                    <div className="severity-grid">{severities.map((severity) => <button key={severity} className={`severity-card ${severity}`} onClick={() => setView('issues')}><span>{severity}</span><strong>{summary?.bySeverity[severity] ?? 0}</strong></button>)}</div>
                  </section>
                  <section className="panel">
                    <div className="section-title"><div><span className="eyebrow">PRIORITY</span><h2>Top triggered issues</h2></div><button className="text-button" onClick={() => setView('issues')}>View all issues →</button></div>
                    <div className="issue-list">
                      {sortedRules.slice(0, 6).map((item) => (
                        <button className="issue-row" key={`${item.ruleId}-${item.severity}-${item.category}`} onClick={() => setView('issues')}>
                          <span className={`severity-dot ${item.severity}`} /><span className="issue-name"><strong>{ruleName(item.ruleId)}</strong><code>{item.ruleId}</code></span><span className="issue-category">{item.category}</span><span className="affected"><strong>{item.count}</strong> affected</span>
                        </button>
                      ))}
                      {!sortedRules.length && <p className="empty">No findings recorded.</p>}
                    </div>
                  </section>
                </>
              )}

              {view === 'issues' && (
                <section className="panel">
                  <div className="section-title"><div><span className="eyebrow">ISSUES</span><h2>Issues by type</h2><p>Each issue appears once. Affected URLs and evidence will open from this view in Slice 5B.</p></div><span>{sortedRules.length} triggered rules</span></div>
                  <div className="table-wrap"><table><thead><tr><th>Issue</th><th>Category</th><th>Severity</th><th>Affected URLs</th></tr></thead><tbody>
                    {sortedRules.map((item) => <tr key={`${item.ruleId}-${item.severity}-${item.category}`}><td><strong className="human-rule">{ruleName(item.ruleId)}</strong><code className="rule-subtitle">{item.ruleId}</code></td><td className="capitalize">{item.category}</td><td><span className={`pill ${item.severity}`}>{item.severity}</span></td><td className="affected-count">{item.count}</td></tr>)}
                    {!sortedRules.length && <tr><td colSpan={4} className="empty">No findings yet.</td></tr>}
                  </tbody></table></div>
                </section>
              )}

              {view === 'pages' && (
                <section className="panel">
                  <div className="section-title"><div><span className="eyebrow">PAGES</span><h2>Crawl results</h2></div><span>Showing first {pages.length} pages</span></div>
                  <div className="table-wrap"><table><thead><tr><th>URL</th><th>Status</th><th>Depth</th><th>Response</th><th>Title</th><th>Issues</th></tr></thead><tbody>
                    {pages.map((page) => <tr key={page.id}><td className="url-cell" title={page.url}>{page.url}</td><td><span className={`http ${page.statusCode >= 400 ? 'bad' : page.statusCode >= 300 ? 'warn' : 'good'}`}>{page.statusCode}</span></td><td>{page.crawlDepth ?? '—'}</td><td>{page.responseTimeMs} ms</td><td className="title-cell">{page.title || <em>Missing</em>}</td><td>{page._count.issues}</td></tr>)}
                  </tbody></table></div>
                </section>
              )}

              {view === 'failures' && (
                <section className="panel">
                  <div className="section-title"><div><span className="eyebrow">CRAWL FAILURES</span><h2>URLs the crawler could not fetch</h2><p>Network, timeout, HTTP and redirect failures are kept separate from SEO findings.</p></div><span>{failureTotal} failures</span></div>
                  <div className="table-wrap"><table><thead><tr><th>URL</th><th>Type</th><th>Status</th><th>Attempts</th><th>Message</th></tr></thead><tbody>
                    {failures.map((failure) => <tr key={failure.id}><td className="url-cell" title={failure.url}>{failure.url}</td><td className="capitalize">{failure.type}</td><td>{failure.statusCode ?? '—'}</td><td>{failure.attempts}</td><td className="failure-message">{failure.message}</td></tr>)}
                    {!failures.length && <tr><td colSpan={5} className="empty">No crawl failures recorded for this audit.</td></tr>}
                  </tbody></table></div>
                </section>
              )}
            </>
          ) : (
            <section className="panel empty-state"><h2>No audit selected</h2><p>Create or select a project, then start an audit. Progress and findings will appear here.</p></section>
          )}
        </div>
      </section>
    </main>
  );
}
