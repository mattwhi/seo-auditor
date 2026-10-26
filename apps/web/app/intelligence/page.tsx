'use client';

import { useEffect, useMemo, useState } from 'react';
import './intelligence.css';

type Project = { id: string; name: string; baseUrl: string };
type Observation = {
  query: string;
  pageUrl: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
};
type Kind = 'low_ctr' | 'striking_distance' | 'page_two' | 'emerging';
type Opportunity = Observation & { id: string; kind: Kind; score: number; confidence: number };
type Report = {
  startDate: string;
  endDate: string;
  property: string;
  observationCount: number;
  observations: Observation[];
  opportunities: Opportunity[];
  note: string;
};
const kindLabels: Record<Kind, string> = {
  low_ctr: 'Low CTR',
  striking_distance: 'Striking distance',
  page_two: 'Page two',
  emerging: 'Emerging query',
};
function isoDate(daysAgo: number) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - daysAgo);
  return d.toISOString().slice(0, 10);
}
function validUrl(url: string) {
  try {
    const u = new URL(url);
    return u.protocol === 'https:' || u.protocol === 'http:' ? u.href : undefined;
  } catch {
    return undefined;
  }
}
export default function IntelligencePage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectId, setProjectId] = useState('');
  const [startDate, setStartDate] = useState(() => isoDate(30));
  const [endDate, setEndDate] = useState(() => isoDate(3));
  const [report, setReport] = useState<Report | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState<'opportunities' | 'all'>('opportunities');
  const [kind, setKind] = useState('all');
  const [search, setSearch] = useState('');
  const [minImpressions, setMinImpressions] = useState(0);
  const [sort, setSort] = useState('priority');
  useEffect(() => {
    const controller = new AbortController();
    fetch('/api/backend/v1/projects', { cache: 'no-store', signal: controller.signal })
      .then(async (r) => {
        if (!r.ok) throw new Error('Unable to load projects');
        return r.json() as Promise<Project[]>;
      })
      .then((rows) => {
        if (!controller.signal.aborted) {
          setProjects(rows);
          setProjectId(rows[0]?.id ?? '');
        }
      })
      .catch((e: unknown) => {
        if (!controller.signal.aborted)
          setError(e instanceof Error ? e.message : 'Unable to load projects');
      });
    return () => controller.abort();
  }, []);
  async function analyse() {
    if (!projectId) return;
    setError('');
    setReport(null);
    setLoading(true);
    try {
      const params = new URLSearchParams({ startDate, endDate });
      const response = await fetch(
        `/api/backend/v1/projects/${encodeURIComponent(projectId)}/intelligence/keyword-opportunities?${params}`,
        { cache: 'no-store' },
      );
      const data = (await response.json()) as Report & { error?: string };
      if (!response.ok)
        throw new Error(
          data.error === 'search_console_not_configured'
            ? 'Configure a Search Console property in Integrations first.'
            : data.error === 'google_credentials_missing'
              ? 'Configure Google credentials in Integrations first.'
              : (data.error ?? `Analysis failed (${response.status})`),
        );
      setReport(data);
      setTab('opportunities');
      setKind('all');
      setSearch('');
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Analysis failed');
    } finally {
      setLoading(false);
    }
  }
  const filtered = useMemo(() => {
    if (!report) return [];
    const rows = tab === 'opportunities' ? report.opportunities : (report.observations ?? []);
    const q = search.trim().toLowerCase();
    return rows
      .filter(
        (row) =>
          row.impressions >= minImpressions &&
          (!q || `${row.query} ${row.pageUrl}`.toLowerCase().includes(q)) &&
          (tab === 'all' || kind === 'all' || ('kind' in row && row.kind === kind)),
      )
      .sort((a, b) =>
        sort === 'impressions'
          ? b.impressions - a.impressions
          : sort === 'clicks'
            ? b.clicks - a.clicks
            : sort === 'position'
              ? a.position - b.position
              : sort === 'ctr'
                ? a.ctr - b.ctr
                : 'score' in a &&
                    'score' in b &&
                    typeof a.score === 'number' &&
                    typeof b.score === 'number'
                  ? b.score - a.score
                  : b.impressions - a.impressions,
      );
  }, [report, tab, kind, search, minImpressions, sort]);
  return (
    <main className="intelligence-page">
      <header className="intelligence-header">
        <span className="intelligence-eyebrow">SEO Auditor / Intelligence / v1.2.1.1</span>
        <h1>Keyword opportunities</h1>
        <p>
          Find opportunities in your Google Search Console data, including lower-volume and page-two
          keywords. Read-only recommendations — no automatic changes.
        </p>
      </header>
      <section className="intelligence-panel" aria-label="Analysis settings">
        <div className="intelligence-controls">
          <label>
            Project
            <select
              value={projectId}
              onChange={(e) => {
                setProjectId(e.target.value);
                setReport(null);
              }}
            >
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} — {p.baseUrl}
                </option>
              ))}
            </select>
          </label>
          <label>
            From
            <input
              type="date"
              value={startDate}
              max={endDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
          </label>
          <label>
            To
            <input
              type="date"
              value={endDate}
              min={startDate}
              max={isoDate(1)}
              onChange={(e) => setEndDate(e.target.value)}
            />
          </label>
          <button
            type="button"
            disabled={loading || !projectId || !startDate || !endDate || startDate > endDate}
            onClick={() => void analyse()}
          >
            {loading ? 'Analysing…' : 'Analyse Search Console'}
          </button>
        </div>
      </section>
      {error && (
        <p className="intelligence-error" role="alert">
          {error} <a href="/admin/integrations">Integration settings</a>
        </p>
      )}
      {!report && !error && (
        <section className="intelligence-panel intelligence-empty">
          <h2>Ready to analyse</h2>
          <p>
            Choose a project and date range to view opportunities and all returned keyword/page
            records. No database migration is required.
          </p>
        </section>
      )}
      {report && (
        <>
          <div className="intelligence-stats">
            <div>
              <span>Opportunities</span>
              <strong>{report.opportunities.length.toLocaleString()}</strong>
            </div>
            <div>
              <span>GSC rows examined</span>
              <strong>{report.observationCount.toLocaleString()}</strong>
            </div>
            <div>
              <span>Search property</span>
              <strong className="intelligence-property">{report.property}</strong>
            </div>
          </div>
          <section className="intelligence-panel">
            <div className="intelligence-section-heading">
              <div>
                <h2>Keyword explorer</h2>
                <p className="intelligence-muted">
                  {report.startDate} to {report.endDate} · Advisory scoring, not a traffic forecast.
                </p>
              </div>
              <span className="intelligence-count">{filtered.length.toLocaleString()} results</span>
            </div>
            <div className="intelligence-tabs" role="tablist" aria-label="Keyword data">
              <button
                type="button"
                role="tab"
                aria-selected={tab === 'opportunities'}
                className={tab === 'opportunities' ? 'active' : ''}
                onClick={() => setTab('opportunities')}
              >
                Opportunities ({report.opportunities.length})
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={tab === 'all'}
                className={tab === 'all' ? 'active' : ''}
                onClick={() => setTab('all')}
              >
                All GSC rows ({report.observationCount})
              </button>
            </div>
            <div className="intelligence-filters">
              <label>
                Search keyword or page
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search keywords or URLs"
                />
              </label>
              {tab === 'opportunities' && (
                <label>
                  Opportunity type
                  <select value={kind} onChange={(e) => setKind(e.target.value)}>
                    <option value="all">All types</option>
                    {Object.entries(kindLabels).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              <label>
                Min. impressions
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={minImpressions}
                  onChange={(e) => setMinImpressions(Math.max(0, Number(e.target.value) || 0))}
                />
              </label>
              <label>
                Sort by
                <select value={sort} onChange={(e) => setSort(e.target.value)}>
                  <option value="priority">
                    {tab === 'opportunities' ? 'Priority score' : 'Impressions'}
                  </option>
                  <option value="impressions">Impressions</option>
                  <option value="clicks">Clicks</option>
                  <option value="ctr">Lowest CTR</option>
                  <option value="position">Best position</option>
                </select>
              </label>
            </div>
            <div className="intelligence-table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Keyword / page</th>
                    {tab === 'opportunities' && <th>Type</th>}
                    <th>Clicks</th>
                    <th>Impressions</th>
                    <th>CTR</th>
                    <th>Position</th>
                    {tab === 'opportunities' && <th>Priority</th>}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((o, i) => {
                    const opportunity = 'kind' in o ? (o as Opportunity) : null;
                    const href = validUrl(o.pageUrl);
                    return (
                      <tr key={`${o.query}-${o.pageUrl}-${opportunity?.kind ?? i}`}>
                        <td>
                          <strong>{o.query}</strong>
                          {href ? (
                            <a href={href} target="_blank" rel="noopener noreferrer">
                              {o.pageUrl}
                            </a>
                          ) : (
                            <small>{o.pageUrl}</small>
                          )}
                        </td>
                        {tab === 'opportunities' && (
                          <td>
                            <span className="intelligence-kind">
                              {opportunity ? kindLabels[opportunity.kind] : '—'}
                            </span>
                          </td>
                        )}
                        <td>{o.clicks.toLocaleString()}</td>
                        <td>{o.impressions.toLocaleString()}</td>
                        <td>{(o.ctr * 100).toFixed(2)}%</td>
                        <td>{o.position.toFixed(1)}</td>
                        {tab === 'opportunities' && (
                          <td>
                            <span className="intelligence-score">
                              {opportunity?.score ?? '—'}/100
                            </span>
                            <small>
                              {opportunity && opportunity.confidence <= 2 ? 'Lower confidence' : ''}
                            </small>
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {filtered.length === 0 && (
              <p className="intelligence-no-results">
                No rows match these filters. Try a lower minimum impression count, or open the All
                GSC rows tab.
              </p>
            )}
            <p className="intelligence-muted intelligence-footnote">{report.note}</p>
          </section>
        </>
      )}
    </main>
  );
}
