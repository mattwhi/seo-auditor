'use client';

import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';

type Project = { id: string; name: string; baseUrl: string; createdAt: string };
type Audit = { id: string; projectId: string; status: string; score: number | null; startedAt: string | null; completedAt: string | null; createdAt: string; _count?: { pages: number; issues: number; crawlFailures: number } };
type RuleSummary = { ruleId: string; severity: string; category: string; count: number };
type Summary = { total: number; bySeverity: Record<string, number>; byCategory: Record<string, number>; byRule: RuleSummary[] };
type PageRow = { id: string; url: string; finalUrl: string; statusCode: number; title: string | null; crawlDepth: number | null; responseTimeMs: number; _count: { issues: number } };
type Issue = { id: string; ruleId: string; severity: string; category: string; message: string; evidence: unknown; page: { url: string; finalUrl: string; statusCode: number } | null };
type CrawlFailure = { id: string; url: string; type: string; message: string; statusCode: number | null; attempts: number; createdAt: string };
type View = 'overview' | 'history' | 'issues' | 'pages' | 'failures';
type ComparedIssue = { fingerprint: string; ruleId: string; severity: string; category: string; message: string; page?: { url: string; finalUrl: string } | null };
type AuditComparison = { currentAuditId: string; baselineAuditId: string; score: { current: number | null; baseline: number | null; delta: number | null }; pages: { current: number; baseline: number; delta: number; added: string[]; removed: string[] }; issues: { current: number; baseline: number; delta: number; new: ComparedIssue[]; resolved: ComparedIssue[]; persistent: ComparedIssue[] } };

type RuleGuide = { title: string; why: string; fix: string };

const api = '/api/backend/v1';
const activeStatuses = new Set(['queued', 'running', 'crawling', 'analysing']);
const severities = ['critical', 'high', 'medium', 'low', 'info'];
const severityRank: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3, info: 4 };
const PAGE_SIZE = 25;

const ruleGuides: Record<string, RuleGuide> = {
  'status.server-error': { title: 'Server error (5xx)', why: 'Server errors prevent crawlers and users from accessing the requested page.', fix: 'Investigate the application, origin or upstream service returning the 5xx response and restore a stable 2xx response.' },
  'status.client-error': { title: 'Client error (4xx)', why: 'Broken URLs waste crawl effort and can send users and search engines to dead ends.', fix: 'Restore the missing page, correct internal links, or redirect the URL to the most relevant live destination.' },
  'redirect.present': { title: 'URL redirects', why: 'Redirects are often intentional, but unnecessary redirects add latency and consume crawl requests.', fix: 'Where practical, update internal links to point directly at the final destination. Keep intentional redirects in place.' },
  'redirect.chain': { title: 'Redirect chain detected', why: 'Multiple redirects add latency and make crawling less efficient.', fix: 'Update the first redirect or internal links so they point directly to the final destination.' },
  'title.missing': { title: 'Page title is missing', why: 'The title element is a strong relevance signal and is commonly used as the search-result headline.', fix: 'Add a unique, descriptive title that accurately represents the page.' },
  'title.too-short': { title: 'Page title is short', why: 'A very short title may not communicate enough context about the page.', fix: 'Review the title and add useful, page-specific context where it improves clarity. Do not pad titles purely to reach a length.' },
  'title.too-long': { title: 'Page title is long', why: 'Long titles may be rewritten or visually truncated and can dilute the most important wording.', fix: 'Put the most useful page-specific wording first and remove unnecessary repetition.' },
  'description.missing': { title: 'Meta description is missing', why: 'A useful meta description can help search engines form an informative search-result snippet.', fix: 'Add a concise, unique description for important indexable pages. Prioritise pages intended to attract organic search visits.' },
  'description.too-short': { title: 'Meta description is short', why: 'A very short description may miss an opportunity to explain the page clearly in search results.', fix: 'Add useful context where appropriate without padding or repeating the title.' },
  'description.too-long': { title: 'Meta description is long', why: 'Long descriptions may be truncated or rewritten in search results.', fix: 'Keep the most useful information early and remove unnecessary repetition.' },
  'heading.h1-missing': { title: 'H1 heading is missing', why: 'A clear primary heading helps users and crawlers understand the main topic of the page.', fix: 'Add one meaningful primary heading that describes the page content.' },
  'heading.h1-empty': { title: 'H1 heading is empty', why: 'An empty primary heading provides no semantic context.', fix: 'Add meaningful text to the H1 or remove the empty heading element.' },
  'heading.h1-multiple': { title: 'Multiple H1 headings', why: 'Multiple H1s are valid HTML, but can indicate an unclear heading hierarchy when used unintentionally.', fix: 'Review the page structure. Keep multiple H1s only when the document structure genuinely requires them.' },
  'indexability.noindex': { title: 'Page is marked noindex', why: 'A noindex directive asks search engines not to include the page in their index.', fix: 'If the page should rank, remove the noindex directive. If exclusion is intentional, no action is required.' },
  'indexability.x-robots-noindex': { title: 'X-Robots-Tag prevents indexing', why: 'A noindex HTTP header asks search engines not to include the resource in their index.', fix: 'Remove the noindex X-Robots-Tag when the page should be indexable. Keep it when exclusion is intentional.' },
  'indexability.canonical-missing': { title: 'Canonical is missing', why: 'A canonical can help search engines understand the preferred URL where duplicate or near-duplicate versions exist.', fix: 'For indexable HTML pages, consider adding a canonical to the preferred URL. Avoid treating a canonical as a substitute for redirects or good URL hygiene.' },
  'indexability.canonical-invalid': { title: 'Canonical URL is invalid', why: 'An invalid canonical cannot reliably communicate the preferred URL.', fix: 'Correct the canonical href so it resolves to a valid HTTP or HTTPS URL.' },
  'indexability.canonical-non-self': { title: 'Canonical points to another URL', why: 'A non-self canonical may be intentional duplicate consolidation, but an unexpected canonical can cause the current URL to be treated as non-preferred.', fix: 'Confirm the destination is intentionally the preferred version. If this page should be canonical, change it to the correct preferred URL.' },
  'image.alt-missing': { title: 'Image alt text missing', why: 'Alternative text helps accessibility and gives search engines context for meaningful images.', fix: 'Add concise alt text to informative images. Decorative images should normally use an empty alt attribute instead.' },
  'content.thin': { title: 'Thin content', why: 'Very little unique page content can make it difficult to demonstrate a clear purpose or satisfy a search intent.', fix: 'Review whether the page needs more useful original content, should be consolidated with another page, or is intentionally lightweight.' },
};

async function json<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, { ...init, cache: 'no-store', headers: { 'content-type': 'application/json', ...(init?.headers ?? {}) } });
  if (!response.ok) throw new Error(`Request failed (${response.status})`);
  return response.json() as Promise<T>;
}

function guideFor(ruleId: string): RuleGuide {
  return ruleGuides[ruleId] ?? { title: ruleId.split('.').at(-1)?.replaceAll('-', ' ') ?? ruleId, why: 'Review the evidence for the affected URLs to understand why this rule was triggered.', fix: 'Inspect the affected pages and correct the underlying technical SEO condition where it is not intentional.' };
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
  const [selectedRule, setSelectedRule] = useState<RuleSummary | null>(null);
  const [ruleIssues, setRuleIssues] = useState<Issue[]>([]);
  const [selectedIssue, setSelectedIssue] = useState<Issue | null>(null);
  const [issueSearch, setIssueSearch] = useState('');
  const [issueSeverity, setIssueSeverity] = useState('all');
  const [issueCategory, setIssueCategory] = useState('all');
  const [issuePage, setIssuePage] = useState(0);
  const [urlPage, setUrlPage] = useState(0);
  const [pageSearch, setPageSearch] = useState('');
  const [name, setName] = useState('');
  const [baseUrl, setBaseUrl] = useState('https://');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [baselineAudit, setBaselineAudit] = useState('');
  const [comparison, setComparison] = useState<AuditComparison | null>(null);
  const [comparisonBusy, setComparisonBusy] = useState(false);

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
    const [detail, findingSummary, pageData, failureData] = await Promise.all([
      json<Audit>(`${api}/audits/${auditId}`),
      json<Summary>(`${api}/audits/${auditId}/issues/summary`),
      json<{ items: PageRow[] }>(`${api}/audits/${auditId}/pages?limit=500`),
      json<{ items: CrawlFailure[]; total: number }>(`${api}/audits/${auditId}/failures?limit=500`),
    ]);
    setAudit(detail); setSummary(findingSummary); setPages(pageData.items); setFailures(failureData.items); setFailureTotal(failureData.total);
  }, []);

  const loadComparison = useCallback(async (auditId: string, baselineId: string) => {
    if (!auditId || !baselineId || auditId === baselineId) { setComparison(null); return; }
    setComparisonBusy(true);
    try {
      setComparison(await json<AuditComparison>(`${api}/audits/${auditId}/compare/${baselineId}`));
    } finally {
      setComparisonBusy(false);
    }
  }, []);

  const openRule = useCallback(async (rule: RuleSummary) => {
    if (!selectedAudit) return;
    setSelectedRule(rule); setSelectedIssue(null); setIssueSearch(''); setUrlPage(0); setView('issues');
    try {
      const data = await json<{ items: Issue[] }>(`${api}/audits/${selectedAudit}/issues?ruleId=${encodeURIComponent(rule.ruleId)}&limit=500`);
      setRuleIssues(data.items);
    } catch (e) { setError(e instanceof Error ? e.message : 'Unable to load affected URLs'); }
  }, [selectedAudit]);

  useEffect(() => { loadProjects().catch((e: Error) => setError(e.message)); }, [loadProjects]);
  useEffect(() => { loadAudits(selectedProject).catch((e: Error) => setError(e.message)); }, [selectedProject, loadAudits]);
  useEffect(() => { setView('overview'); setSelectedRule(null); setRuleIssues([]); setComparison(null); loadAudit(selectedAudit).catch((e: Error) => setError(e.message)); }, [selectedAudit, loadAudit]);
  useEffect(() => { const index = audits.findIndex((item) => item.id === selectedAudit); const fallback = audits.slice(index + 1).find((item) => item.status === 'completed')?.id ?? ''; setBaselineAudit((current) => current && current !== selectedAudit && audits.some((item) => item.id === current && item.status === 'completed') ? current : fallback); }, [audits, selectedAudit]);
  useEffect(() => { if (view !== 'history') return; loadComparison(selectedAudit, baselineAudit).catch((e: Error) => setError(e.message)); }, [view, selectedAudit, baselineAudit, loadComparison]);
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
  const scoreClass = useMemo(() => (audit?.score == null ? '' : audit.score >= 80 ? 'good' : audit.score >= 50 ? 'warn' : 'bad'), [audit?.score]);
  const sortedRules = useMemo(() => [...(summary?.byRule ?? [])].sort((a, b) => (severityRank[a.severity] ?? 99) - (severityRank[b.severity] ?? 99) || b.count - a.count || a.ruleId.localeCompare(b.ruleId)), [summary]);
  const filteredRules = useMemo(() => sortedRules.filter((rule) => (issueSeverity === 'all' || rule.severity === issueSeverity) && (issueCategory === 'all' || rule.category === issueCategory) && (!issueSearch || guideFor(rule.ruleId).title.toLowerCase().includes(issueSearch.toLowerCase()) || rule.ruleId.toLowerCase().includes(issueSearch.toLowerCase()))), [sortedRules, issueSeverity, issueCategory, issueSearch]);
  const categories = useMemo(() => Array.from(new Set(sortedRules.map((item) => item.category))).sort(), [sortedRules]);
  const actionable = severities.slice(0, 4).reduce((total, severity) => total + (summary?.bySeverity[severity] ?? 0), 0);
  const filteredRuleIssues = useMemo(() => ruleIssues.filter((issue) => !issueSearch || issue.page?.url.toLowerCase().includes(issueSearch.toLowerCase()) || issue.page?.finalUrl.toLowerCase().includes(issueSearch.toLowerCase())), [ruleIssues, issueSearch]);
  const visibleRuleIssues = filteredRuleIssues.slice(urlPage * PAGE_SIZE, (urlPage + 1) * PAGE_SIZE);
  const filteredPages = useMemo(() => pages.filter((page) => !pageSearch || page.url.toLowerCase().includes(pageSearch.toLowerCase()) || page.finalUrl.toLowerCase().includes(pageSearch.toLowerCase()) || (page.title ?? '').toLowerCase().includes(pageSearch.toLowerCase())), [pages, pageSearch]);
  const visiblePages = filteredPages.slice(issuePage * PAGE_SIZE, (issuePage + 1) * PAGE_SIZE);

  function goToIssues(severity?: string) { setSelectedRule(null); setRuleIssues([]); setSelectedIssue(null); setIssueSeverity(severity ?? 'all'); setIssueSearch(''); setView('issues'); }

  return <main>
    <header className="topbar"><div><span className="eyebrow">OPEN SOURCE · PRE-ALPHA</span><h1>SEO Auditor</h1><p>Run deterministic technical SEO audits and inspect the evidence behind every finding.</p></div><div className="version">v0.4.0 dev</div></header>
    {error && <div className="alert">{error}</div>}
    <section className="workspace">
      <aside className="sidebar panel">
        <div className="section-title"><div><span className="eyebrow">PROJECTS</span><h2>Audit targets</h2></div></div>
        <div className="project-list">{projects.map((item) => <button key={item.id} className={item.id === selectedProject ? 'project active' : 'project'} onClick={() => setSelectedProject(item.id)}><strong>{item.name}</strong><span>{item.baseUrl}</span></button>)}</div>
        <form onSubmit={createProject} className="create-form"><h3>New project</h3><input required placeholder="Project name" value={name} onChange={(e) => setName(e.target.value)} /><input required type="url" placeholder="https://example.com" value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)} /><button className="primary" disabled={busy}>Create project</button></form>
      </aside>
      <div className="content">
        <section className="panel hero-panel"><div><span className="eyebrow">SELECTED PROJECT</span><h2>{project?.name ?? 'Create a project to begin'}</h2><p>{project?.baseUrl ?? 'Add a site and launch its first technical SEO audit.'}</p></div><button className="primary start" disabled={!selectedProject || busy} onClick={startAudit}>{busy ? 'Working…' : 'Start new audit'}</button></section>
        {audits.length > 0 && <section className="audit-strip"><label>Audit<select value={selectedAudit} onChange={(e) => setSelectedAudit(e.target.value)}>{audits.map((item) => { const status = item.id === selectedAudit && audit ? audit.status : item.status; return <option key={item.id} value={item.id}>{new Date(item.createdAt).toLocaleString()} · {status}</option>; })}</select></label><span className={`status ${audit?.status ?? ''}`}>{audit?.status ?? '—'}</span></section>}
        {audit ? <>
          <nav className="view-tabs" aria-label="Audit results">{(['overview','history','issues','pages','failures'] as View[]).map((item) => <button key={item} className={view === item ? 'view-tab active' : 'view-tab'} onClick={() => { setView(item); if (item === 'issues') setSelectedRule(null); }}>{item === 'failures' ? 'Crawl failures' : item}{item === 'issues' && <span>{summary?.byRule.length ?? 0}</span>}{item === 'pages' && <span>{audit._count?.pages ?? pages.length}</span>}{item === 'failures' && <span>{failureTotal}</span>}</button>)}</nav>
          {view === 'overview' && <>
            <section className="metrics"><article><span>SEO score</span><strong className={scoreClass}>{audit.score ?? '—'}</strong></article><article><span>Pages crawled</span><strong>{audit._count?.pages ?? pages.length}</strong></article><article><span>Actionable findings</span><strong>{actionable}</strong><small>{summary?.bySeverity.info ?? 0} informational</small></article><article><span>Status</span><strong className="metric-status">{audit.status}</strong></article></section>
            <section className="panel"><div className="section-title"><div><span className="eyebrow">SEVERITY</span><h2>Finding overview</h2></div><span>{summary?.total ?? 0} total findings</span></div><div className="severity-grid">{severities.map((severity) => <button key={severity} className={`severity-card ${severity}`} onClick={() => goToIssues(severity)}><span>{severity}</span><strong>{summary?.bySeverity[severity] ?? 0}</strong></button>)}</div></section>
            <section className="panel"><div className="section-title"><div><span className="eyebrow">PRIORITY</span><h2>Top triggered issues</h2></div><button className="text-button" onClick={() => goToIssues()}>View all issues →</button></div><div className="issue-list">{sortedRules.slice(0,6).map((item) => <button className="issue-row" key={`${item.ruleId}-${item.severity}-${item.category}`} onClick={() => openRule(item)}><span className={`severity-dot ${item.severity}`} /><span className="issue-name"><strong>{guideFor(item.ruleId).title}</strong><code>{item.ruleId}</code></span><span className="issue-category">{item.category}</span><span className="affected"><strong>{item.count}</strong> affected</span></button>)}{!sortedRules.length && <p className="empty">No findings recorded.</p>}</div></section>
          </>}
          {view === 'history' && <section className="comparison-stack">
            <section className="panel"><div className="section-title"><div><span className="eyebrow">AUDIT HISTORY</span><h2>Compare audits</h2><p>Measure score, page and finding changes against another completed audit for this project.</p></div></div><div className="compare-controls"><label>Current audit<strong>{new Date(audit.createdAt).toLocaleString()}</strong></label><span>vs</span><label>Baseline audit<select value={baselineAudit} onChange={(e) => setBaselineAudit(e.target.value)}><option value="">Select a completed audit</option>{audits.filter((item) => item.id !== selectedAudit && item.status === 'completed').map((item) => <option key={item.id} value={item.id}>{new Date(item.createdAt).toLocaleString()} · score {item.score ?? '—'}</option>)}</select></label></div></section>
            {!baselineAudit && <section className="panel empty-state"><h2>No baseline audit available</h2><p>Run at least two completed audits for this project to compare changes over time.</p></section>}
            {baselineAudit && comparisonBusy && <section className="panel empty-state"><h2>Comparing audits…</h2></section>}
            {baselineAudit && comparison && !comparisonBusy && <ComparisonView comparison={comparison} />}
          </section>}
          {view === 'issues' && !selectedRule && <section className="panel">
            <div className="section-title"><div><span className="eyebrow">ISSUES</span><h2>Issues by type</h2><p>Filter the audit, then open an issue to inspect affected URLs, evidence and remediation guidance.</p></div><span>{filteredRules.length} of {sortedRules.length} triggered rules</span></div>
            <div className="filters"><input placeholder="Search issue or rule ID" value={issueSearch} onChange={(e) => setIssueSearch(e.target.value)} /><select value={issueSeverity} onChange={(e) => setIssueSeverity(e.target.value)}><option value="all">All severities</option>{severities.map((s) => <option key={s} value={s}>{s}</option>)}</select><select value={issueCategory} onChange={(e) => setIssueCategory(e.target.value)}><option value="all">All categories</option>{categories.map((c) => <option key={c} value={c}>{c}</option>)}</select></div>
            <div className="table-wrap"><table><thead><tr><th>Issue</th><th>Category</th><th>Severity</th><th>Affected URLs</th><th></th></tr></thead><tbody>{filteredRules.map((item) => <tr className="clickable-row" key={`${item.ruleId}-${item.severity}-${item.category}`} onClick={() => openRule(item)}><td><strong className="human-rule">{guideFor(item.ruleId).title}</strong><code className="rule-subtitle">{item.ruleId}</code></td><td className="capitalize">{item.category}</td><td><span className={`pill ${item.severity}`}>{item.severity}</span></td><td className="affected-count">{item.count}</td><td className="open-cell">Open →</td></tr>)}{!filteredRules.length && <tr><td colSpan={5} className="empty">No issues match these filters.</td></tr>}</tbody></table></div>
          </section>}
          {view === 'issues' && selectedRule && <IssueWorkspace rule={selectedRule} issues={visibleRuleIssues} total={filteredRuleIssues.length} search={issueSearch} setSearch={(value) => { setIssueSearch(value); setUrlPage(0); }} page={urlPage} setPage={setUrlPage} selected={selectedIssue} setSelected={setSelectedIssue} onBack={() => { setSelectedRule(null); setRuleIssues([]); setSelectedIssue(null); setIssueSearch(''); }} />}
          {view === 'pages' && <section className="panel"><div className="section-title"><div><span className="eyebrow">PAGES</span><h2>Crawl results</h2><p>Search across requested URL, final URL and page title.</p></div><span>{filteredPages.length} of {pages.length} pages</span></div><div className="filters single"><input placeholder="Search URLs or titles" value={pageSearch} onChange={(e) => { setPageSearch(e.target.value); setIssuePage(0); }} /></div><div className="table-wrap"><table><thead><tr><th>URL</th><th>Status</th><th>Depth</th><th>Response</th><th>Title</th><th>Issues</th></tr></thead><tbody>{visiblePages.map((page) => <tr key={page.id}><td className="url-cell" title={page.url}>{page.url}</td><td><span className={`http ${page.statusCode >= 400 ? 'bad' : page.statusCode >= 300 ? 'warn' : 'good'}`}>{page.statusCode}</span></td><td>{page.crawlDepth ?? '—'}</td><td>{page.responseTimeMs} ms</td><td className="title-cell">{page.title || <em>Missing</em>}</td><td>{page._count.issues}</td></tr>)}</tbody></table></div><Pager page={issuePage} total={filteredPages.length} setPage={setIssuePage} /></section>}
          {view === 'failures' && <section className="panel"><div className="section-title"><div><span className="eyebrow">CRAWL FAILURES</span><h2>URLs the crawler could not fetch</h2><p>Network, timeout, HTTP and redirect failures are kept separate from SEO findings.</p></div><span>{failureTotal} failures</span></div><div className="table-wrap"><table><thead><tr><th>URL</th><th>Type</th><th>Status</th><th>Attempts</th><th>Message</th></tr></thead><tbody>{failures.map((failure) => <tr key={failure.id}><td className="url-cell" title={failure.url}>{failure.url}</td><td className="capitalize">{failure.type}</td><td>{failure.statusCode ?? '—'}</td><td>{failure.attempts}</td><td className="failure-message">{failure.message}</td></tr>)}{!failures.length && <tr><td colSpan={5} className="empty">No crawl failures recorded for this audit.</td></tr>}</tbody></table></div></section>}
        </> : <section className="panel empty-state"><h2>No audit selected</h2><p>Create or select a project, then start an audit. Progress and findings will appear here.</p></section>}
      </div>
    </section>
  </main>;
}

function Delta({ value }: { value: number | null }) {
  if (value == null) return <span className="delta neutral">—</span>;
  const sign = value > 0 ? '+' : '';
  return <span className={`delta ${value > 0 ? 'up' : value < 0 ? 'down' : 'neutral'}`}>{sign}{value}</span>;
}

function ComparisonView({ comparison }: { comparison: AuditComparison }) {
  const sections: Array<{ title: string; tone: string; items: ComparedIssue[] }> = [
    { title: 'New findings', tone: 'new', items: comparison.issues.new },
    { title: 'Resolved findings', tone: 'resolved', items: comparison.issues.resolved },
    { title: 'Persistent findings', tone: 'persistent', items: comparison.issues.persistent },
  ];
  return <>
    <section className="comparison-metrics"><article><span>SEO score</span><strong>{comparison.score.current ?? '—'}</strong><Delta value={comparison.score.delta} /></article><article><span>Pages</span><strong>{comparison.pages.current}</strong><Delta value={comparison.pages.delta} /></article><article><span>Findings</span><strong>{comparison.issues.current}</strong><Delta value={comparison.issues.delta} /></article><article><span>Changes</span><strong>{comparison.issues.new.length + comparison.issues.resolved.length}</strong><small>{comparison.issues.new.length} new · {comparison.issues.resolved.length} resolved</small></article></section>
    <section className="panel"><div className="section-title"><div><span className="eyebrow">PAGE CHANGES</span><h2>URLs discovered between audits</h2></div><span>{comparison.pages.added.length} added · {comparison.pages.removed.length} removed</span></div><div className="page-change-grid"><div><h3>Added</h3>{comparison.pages.added.length ? comparison.pages.added.map((url) => <code key={url}>{url}</code>) : <p>None</p>}</div><div><h3>Removed</h3>{comparison.pages.removed.length ? comparison.pages.removed.map((url) => <code key={url}>{url}</code>) : <p>None</p>}</div></div></section>
    {sections.map((section) => <section className="panel" key={section.title}><div className="section-title"><div><span className="eyebrow">FINDING LIFECYCLE</span><h2>{section.title}</h2></div><span>{section.items.length}</span></div><div className="comparison-findings">{section.items.slice(0,100).map((item) => <div className={`comparison-finding ${section.tone}`} key={item.fingerprint}><span className={`pill ${item.severity}`}>{item.severity}</span><div><strong>{guideFor(item.ruleId).title}</strong><code>{item.ruleId}</code><p>{item.page?.finalUrl ?? item.page?.url ?? 'Audit-level finding'}</p></div></div>)}{!section.items.length && <p className="empty">None.</p>}{section.items.length > 100 && <p className="empty">Showing first 100 of {section.items.length}.</p>}</div></section>)}
  </>;
}

function Pager({ page, total, setPage }: { page: number; total: number; setPage: (page: number) => void }) {
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  if (total <= PAGE_SIZE) return null;
  return <div className="pager"><span>Page {page + 1} of {pages} · {total} results</span><div><button disabled={page === 0} onClick={() => setPage(Math.max(0, page - 1))}>← Previous</button><button disabled={page >= pages - 1} onClick={() => setPage(Math.min(pages - 1, page + 1))}>Next →</button></div></div>;
}

function IssueWorkspace({ rule, issues, total, search, setSearch, page, setPage, selected, setSelected, onBack }: { rule: RuleSummary; issues: Issue[]; total: number; search: string; setSearch: (value: string) => void; page: number; setPage: (page: number) => void; selected: Issue | null; setSelected: (issue: Issue | null) => void; onBack: () => void }) {
  const guide = guideFor(rule.ruleId);
  return <section className="issue-workspace">
    <section className="panel issue-guide"><button className="text-button back" onClick={onBack}>← All issues</button><div className="issue-guide-head"><div><span className="eyebrow">ISSUE DETAIL</span><h2>{guide.title}</h2><code>{rule.ruleId}</code></div><div className="guide-badges"><span className={`pill ${rule.severity}`}>{rule.severity}</span><span className="category-badge">{rule.category}</span><strong>{rule.count} affected</strong></div></div><div className="guidance-grid"><article><span>Why this matters</span><p>{guide.why}</p></article><article><span>How to fix</span><p>{guide.fix}</p></article></div></section>
    <section className="panel"><div className="section-title"><div><span className="eyebrow">AFFECTED URLS</span><h2>Pages triggering this issue</h2><p>Select a URL to inspect the exact evidence recorded by the rule engine.</p></div><span>{total} matching URLs</span></div><div className="filters single"><input placeholder="Search affected URLs" value={search} onChange={(e) => setSearch(e.target.value)} /></div><div className="detail-grid"><div><div className="table-wrap"><table><thead><tr><th>URL</th><th>Status</th><th>Evidence</th></tr></thead><tbody>{issues.map((issue) => <tr key={issue.id} className={selected?.id === issue.id ? 'clickable-row selected-row' : 'clickable-row'} onClick={() => setSelected(issue)}><td className="url-cell" title={issue.page?.url}>{issue.page?.url ?? 'Audit-level finding'}</td><td>{issue.page?.statusCode ?? '—'}</td><td className="open-cell">Inspect →</td></tr>)}{!issues.length && <tr><td colSpan={3} className="empty">No affected URLs match this search.</td></tr>}</tbody></table></div><Pager page={page} total={total} setPage={setPage} /></div><aside className="evidence-panel">{selected ? <><span className="eyebrow">RECORDED EVIDENCE</span><h3>{selected.page?.url ?? 'Finding evidence'}</h3><p>{selected.message}</p><dl><dt>Requested URL</dt><dd>{selected.page?.url ?? '—'}</dd><dt>Final URL</dt><dd>{selected.page?.finalUrl ?? '—'}</dd><dt>HTTP status</dt><dd>{selected.page?.statusCode ?? '—'}</dd></dl><pre>{JSON.stringify(selected.evidence ?? {}, null, 2)}</pre></> : <div className="evidence-empty"><strong>Select an affected URL</strong><p>The deterministic evidence for that finding will appear here.</p></div>}</aside></div></section>
  </section>;
}
