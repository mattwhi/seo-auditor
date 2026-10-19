'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import './AiWorkspace.css';

type Policy = { enabled: boolean; mode: 'manual' | 'automatic'; maxPagesPerAudit: number; maxAnalysesPerDay: number; configured: boolean; model: string };
type Suggestion = { ruleId: string; field: string; priority: string; currentValue: string; proposedValue: string; explanation: string; evidence: string };
type Review = Suggestion & { id: string; analysisId: string; suggestionIndex: number; status: string; reviewedAt: string | null; reviewerId?: string | null };
type Analysis = { id: string; pageId: string; status: string; summary: string | null; recommendations: Suggestion[] | null; createdAt: string; errorCode: string | null; model?: string };
type Filter = 'all' | 'pending' | 'approved' | 'rejected';

async function request(projectId: string, action: string, method = 'GET', data?: unknown, auditId?: string, extra?: Record<string,string>) {
  const url = new URL('/api/ai', window.location.origin);
  url.searchParams.set('projectId', projectId); url.searchParams.set('action', action);
  if (auditId) url.searchParams.set('auditId', auditId);
  if (extra) Object.entries(extra).forEach(([key,value]) => url.searchParams.set(key,value));
  const response = await fetch(url, { method, cache: 'no-store', headers: method === 'GET' ? {} : { 'content-type': 'application/json' }, body: data ? JSON.stringify(data) : undefined });
  const result = await response.json();
  if (!response.ok) throw new Error(typeof result.error === 'string' ? result.error : `HTTP ${response.status}`);
  return result;
}
function downloadCsv(rows: Review[]) {
  const columns: Array<keyof Review> = ['analysisId','ruleId','field','priority','status','currentValue','proposedValue','explanation','evidence','reviewedAt'];
  const csv = [columns.join(','), ...rows.map(r => columns.map(k => `"${String(r[k] ?? '').replace(/"/g,'""')}"`).join(','))].join('\r\n');
  const blob = new Blob(['\uFEFF',csv], {type:'text/csv;charset=utf-8'});
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a'); link.href=url; link.download='seo-ai-remediation-reviews.csv'; link.click();
  URL.revokeObjectURL(url);
}
export default function AiWorkspace({ projectId, auditId, pages, focusPageId, reviewOnly = false }: { projectId: string; auditId: string; pages: Array<{ id: string; finalUrl: string; title: string | null }>; focusPageId?: string; reviewOnly?: boolean }) {
  const [policy, setPolicy] = useState<Policy | null>(null);
  const [analyses, setAnalyses] = useState<Analysis[]>([]);
  const [reviews, setReviews] = useState<Record<string, Review[]>>({});
  const [expanded, setExpanded] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [pageId, setPageId] = useState('');
  const [busy, setBusy] = useState(false);
  const [loadingReviews, setLoadingReviews] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [query, setQuery] = useState('');
  const [priority, setPriority] = useState('all');
  const [showAllHistory, setShowAllHistory] = useState(false);
  const reload = useCallback(async () => {
    const [p,a] = await Promise.all([request(projectId,'settings'),request(projectId,'analyses','GET',undefined,auditId)]);
    setPolicy(p); setAnalyses(a);
  }, [projectId,auditId]);
  useEffect(() => { void reload().catch(e => setError(String(e))); }, [reload]);
  useEffect(() => { setPageId(focusPageId || pages[0]?.id || ''); }, [pages, focusPageId]);
  useEffect(() => { setReviews({}); setExpanded(null); setShowAllHistory(false); }, [projectId,auditId]);

  const allReviews = useMemo(() => Object.values(reviews).flat(), [reviews]);
  const counts = useMemo(() => ({
    pending: allReviews.filter(r=>r.status==='pending').length,
    approved: allReviews.filter(r=>r.status==='approved').length,
    rejected: allReviews.filter(r=>r.status==='rejected').length,
  }), [allReviews]);
  const scopedAnalyses = focusPageId ? analyses.filter(a => a.pageId === focusPageId) : analyses;
  const visibleHistory = showAllHistory ? scopedAnalyses : scopedAnalyses.slice(0,5);
  async function loadReviews(analysisId: string) {
    if (expanded === analysisId) { setExpanded(null); return; }
    setExpanded(analysisId);
    if (reviews[analysisId]) return;
    setLoadingReviews(analysisId); setError('');
    try {
      const result = await request(projectId, 'reviews', 'GET', undefined, undefined, { analysisId });
      setReviews(old => ({ ...old, [analysisId]: result }));
    } catch(e) { setError(e instanceof Error ? e.message : String(e)); }
    finally { setLoadingReviews(null); }
  }
  async function reviewAction(analysisId: string, reviewId: string, action: 'edit'|'approve'|'reject'|'proposal', proposedValue?: string) {
    setBusy(true); setError(''); setNotice('');
    try {
      if (action === 'proposal') {
        const draft = await request(projectId, 'proposal', 'POST', {}, undefined, {reviewId});
        setNotice(`Draft WordPress proposal ${draft.id} ${draft.alreadyExists ? 'already exists' : 'created'}. Open Remediation to review and run preflight; nothing was published.`);
        return;
      }
      await request(projectId, 'review', 'PATCH', action === 'edit' ? {action, proposedValue} : {action}, undefined, {reviewId});
      const result = await request(projectId, 'reviews', 'GET', undefined, undefined, {analysisId});
      setReviews(old => ({...old, [analysisId]: result}));
      setNotice(action === 'edit' ? 'Proposed value saved. Approval is still required.' : action === 'approve' ? 'Approved for the review workflow. Nothing has been published.' : 'Suggestion rejected and decision recorded.');
    } catch(e) { setError(e instanceof Error ? e.message : String(e)); }
    finally { setBusy(false); }
  }
  async function run(action: string, method: string, data: unknown) {
    setBusy(true); setError(''); setNotice('');
    try {
      await request(projectId,action,method,data);
      setNotice(action === 'analyse' ? 'Analysis saved. All suggestions require human review.' : 'Project AI settings saved.');
      await reload();
    } catch(e) { setError(e instanceof Error ? e.message : String(e)); }
    finally { setBusy(false); }
  }
  const matches = (r:Review) => (filter==='all' || r.status===filter) &&
    (priority==='all' || r.priority.toLowerCase()===priority) &&
    [r.ruleId,r.field,r.explanation,r.evidence,r.proposedValue].join(' ').toLowerCase().includes(query.toLowerCase());
  return <section className="panel ai-workspace">
    <div className="ai-header">
      <div><span className="eyebrow">v0.9.2 · AI REMEDIATION</span><h2>AI recommendations</h2><p>Generate evidence-based suggestions, compare proposed changes and record human decisions.</p></div>
      <div className="ai-header-actions"><span className={`ai-connection ${policy?.configured ? 'is-online' : ''}`}><span className="ai-dot"/>{policy?.configured ? 'OpenAI connected' : 'OpenAI not configured'}</span><button type="button" className="ai-btn ai-btn-quiet" onClick={() => void reload().catch(e=>setError(String(e)))} disabled={busy}>↻ Refresh</button></div>
    </div>
    {error && <div className="ai-alert ai-error" role="alert">{error}<button type="button" onClick={()=>setError('')} aria-label="Dismiss error">×</button></div>}
    {notice && <div className="ai-alert ai-success" role="status">{notice}<button type="button" onClick={()=>setNotice('')} aria-label="Dismiss notice">×</button></div>}
    <div className="ai-stats">
      <div className="ai-stat"><span>Analyses</span><strong>{analyses.length}</strong><small>Current audit</small></div>
      <div className="ai-stat"><span>Awaiting review</span><strong>{counts.pending}</strong><small>Loaded suggestions</small></div>
      <div className="ai-stat"><span>Approved</span><strong>{counts.approved}</strong><small>Not published</small></div>
      <div className="ai-stat"><span>Rejected</span><strong>{counts.rejected}</strong><small>Decisions recorded</small></div>
    </div>
    <div className="ai-layout">
      <div className="ai-main">
        {!reviewOnly && <section className="ai-surface">
          <div className="ai-surface-head"><div><span className="eyebrow">NEW ANALYSIS</span><h3>Analyse a page</h3><p>AI reads stored crawl evidence; it does not modify the website.</p></div></div>
          <div className="ai-form-row">
            <label className="ai-field ai-grow"><span>Audited page</span><select disabled={Boolean(focusPageId)} value={pageId} onChange={e=>setPageId(e.target.value)}>{pages.map(p=><option key={p.id} value={p.id}>{p.title || p.finalUrl}</option>)}</select></label>
            <button className="ai-btn ai-btn-primary" disabled={busy || !pageId || !policy?.enabled || !policy?.configured} onClick={()=>void run('analyse','POST',{auditId,pageId})}>{busy ? 'Processing…' : '✦ Analyse page'}</button>
          </div>
          {!policy?.enabled && <p className="ai-hint">Enable AI analysis in project settings to start a new analysis.</p>}
        </section>}
        <section className="ai-surface">
          <div className="ai-surface-head"><div><span className="eyebrow">HUMAN REVIEW</span><h3>Analysis history <span className="ai-count">{scopedAnalyses.length}</span></h3><p>Select an analysis to inspect its proposed changes and record decisions.</p></div></div>
          <div className="ai-toolbar">
            <label className="ai-field ai-grow"><span>Search recommendations</span><input placeholder="Rule, field, proposed value…" value={query} onChange={e=>setQuery(e.target.value)}/></label>
            <label className="ai-field"><span>Decision</span><select value={filter} onChange={e=>setFilter(e.target.value as Filter)}><option value="all">All decisions</option><option value="pending">Pending</option><option value="approved">Approved</option><option value="rejected">Rejected</option></select></label>
            <label className="ai-field"><span>Priority</span><select value={priority} onChange={e=>setPriority(e.target.value)}><option value="all">All priorities</option><option value="high">High</option><option value="medium">Medium</option><option value="low">Low</option></select></label>
            <button className="ai-btn ai-btn-quiet" disabled={!allReviews.length} onClick={()=>downloadCsv(allReviews)}>↓ Export CSV</button>
          </div>
          <p className="ai-hint">Filters and export apply to loaded reviews. Open an analysis to load its saved decisions.</p>
          {scopedAnalyses.length===0 && <div className="ai-empty">No analyses for this audit yet. Choose a page above to begin.</div>}
          <div className="ai-history">
            {visibleHistory.map(a=>{
              const list=reviews[a.id] ?? [];
              const completed=a.status==='completed';
              const open=expanded===a.id;
              const selected=list.filter(matches);
              return <article key={a.id} className={`ai-analysis ${open?'ai-analysis-open':''}`}>
                <div className="ai-analysis-head">
                  <div className="ai-analysis-info"><span className={`ai-status ai-status-${a.status}`}>{a.status}</span><span className="ai-date">{new Date(a.createdAt).toLocaleString()}</span><strong>{pages.find(p=>p.id===a.pageId)?.title || pages.find(p=>p.id===a.pageId)?.finalUrl || 'Audited page'}</strong><p>{a.summary || a.errorCode || 'Analysis in progress'}</p></div>
                  {completed && <button className="ai-btn ai-btn-secondary" disabled={busy} onClick={()=>void loadReviews(a.id)}>{loadingReviews===a.id?'Loading…':open?'Hide reviews':`Review ${a.recommendations?.length ?? ''} suggestions ${open?'':'→'}`}</button>}
                </div>
                {open && <div className="ai-review-list">
                  {loadingReviews===a.id && <p className="ai-hint">Loading review decisions…</p>}
                  {!loadingReviews && reviews[a.id] && <div className="ai-review-summary"><span>{list.filter(r=>r.status==='pending').length} pending</span><span>{list.filter(r=>r.status==='approved').length} approved</span><span>{list.filter(r=>r.status==='rejected').length} rejected</span></div>}
                  {selected.map(r=><ReviewEditor key={r.id} review={r} busy={busy} onAction={(action,value)=>reviewAction(a.id,r.id,action,value)}/>)}
                  {!loadingReviews && reviews[a.id] && selected.length===0 && <div className="ai-empty">No recommendations match the selected filters.</div>}
                </div>}
              </article>;
            })}
          </div>
          {scopedAnalyses.length>5 && <button className="ai-btn ai-btn-quiet ai-more" onClick={()=>setShowAllHistory(!showAllHistory)}>{showAllHistory?'Show recent analyses':`Show all ${scopedAnalyses.length} analyses`}</button>}
        </section>
      </div>
      <aside className="ai-side">
        <section className="ai-surface ai-settings">
          <div className="ai-surface-head"><div><span className="eyebrow">PROJECT CONTROLS</span><h3>AI settings</h3></div><button className="ai-btn ai-btn-quiet" onClick={()=>setSettingsOpen(!settingsOpen)} aria-expanded={settingsOpen}>{settingsOpen?'Close':'Edit'}</button></div>
          <div className="ai-setting-summary"><span>Model</span><strong>{policy?.model ?? '—'}</strong><span>Analysis mode</span><strong>{policy?.mode ?? '—'}</strong><span>Project AI</span><strong>{policy?.enabled?'Enabled':'Disabled'}</strong></div>
          {settingsOpen && policy && <div className="ai-settings-fields">
            <label className="ai-toggle"><input type="checkbox" checked={policy.enabled} onChange={e=>setPolicy({...policy,enabled:e.target.checked})}/><span>Enable AI analysis</span></label>
            <label className="ai-field"><span>Analysis mode</span><select value={policy.mode} onChange={e=>setPolicy({...policy,mode:e.target.value as Policy['mode']})}><option value="manual">Manual (default)</option><option value="automatic">Automatic after audit (opt-in)</option></select></label>
            <label className="ai-field"><span>Pages per automatic audit</span><input type="number" min="1" max="10" value={policy.maxPagesPerAudit} onChange={e=>setPolicy({...policy,maxPagesPerAudit:Number(e.target.value)})}/></label>
            <label className="ai-field"><span>Analyses per 24 hours</span><input type="number" min="1" max="100" value={policy.maxAnalysesPerDay} onChange={e=>setPolicy({...policy,maxAnalysesPerDay:Number(e.target.value)})}/></label>
            <button className="ai-btn ai-btn-primary" disabled={busy} onClick={()=>void run('settings','PUT',{enabled:policy.enabled,mode:policy.mode,maxPagesPerAudit:policy.maxPagesPerAudit,maxAnalysesPerDay:policy.maxAnalysesPerDay})}>Save settings</button>
          </div>}
        </section>
        <section className="ai-surface ai-safety"><span className="eyebrow">SAFETY & APPROVALS</span><h3>Human-controlled changes</h3><p>Every AI suggestion requires review. Approving a suggestion records a decision only.</p><div className="ai-safety-step"><span>1</span>Analyse crawl evidence</div><div className="ai-safety-step"><span>2</span>Edit and approve or reject</div><div className="ai-safety-step"><span>3</span>Use the separate WordPress remediation workflow for eligible fixes</div><p className="ai-hint">No automatic publishing. Approved title and meta-description suggestions can create a separate draft proposal when a matching audit issue and a unique WordPress target are verified. Preflight and execution remain separate.</p></section>
      </aside>
    </div>
  </section>;
}

function ReviewEditor({review,busy,onAction}:{review:Review;busy:boolean;onAction:(action:'edit'|'approve'|'reject'|'proposal',value?:string)=>Promise<void>}) {
  const [value,setValue]=useState(review.proposedValue);
  const [showEvidence,setShowEvidence]=useState(false);
  useEffect(()=>setValue(review.proposedValue),[review.proposedValue]);
  const pending=review.status==='pending';
  const changed=value!==review.proposedValue;
  return <section className="ai-review">
    <div className="ai-review-head"><div><div className="ai-review-tags"><span className={`ai-priority ai-priority-${review.priority.toLowerCase()}`}>{review.priority}</span><span className={`ai-status ai-status-${review.status}`}>{review.status}</span><code>{review.ruleId}</code></div><h4>{review.field.replace(/([A-Z])/g,' $1').replace(/^./,c=>c.toUpperCase())}</h4></div><span className="ai-review-id">#{review.suggestionIndex+1}</span></div>
    <p className="ai-explanation">{review.explanation}</p>
    <div className="ai-diff"><div className="ai-diff-before"><span className="ai-diff-label">− Before · AI-reported</span><p>{review.currentValue || <em>Not present</em>}</p></div><div className="ai-diff-after"><label className="ai-diff-label" htmlFor={`ai-proposal-${review.id}`}>+ After · Editable proposal</label><textarea id={`ai-proposal-${review.id}`} rows={3} maxLength={2000} value={value} disabled={busy || !pending} onChange={e=>setValue(e.target.value)}/><small>{value.length} / 2000 characters</small></div></div>
    <button className="ai-evidence-toggle" type="button" onClick={()=>setShowEvidence(!showEvidence)} aria-expanded={showEvidence}>{showEvidence?'▾ Hide evidence':'▸ View crawl evidence'}</button>
    {showEvidence && <p className="ai-evidence">{review.evidence || 'No evidence supplied.'} Approval of supported fields is checked against the stored crawl snapshot.</p>}
    <div className="ai-review-footer">
      <span className="ai-hint">{review.reviewedAt?`Decision recorded ${new Date(review.reviewedAt).toLocaleString()}`:changed?'Save your edit before approving.':'Approval does not publish.'}</span>
      {review.status==='approved' && <div className="ai-review-actions"><button className="ai-btn ai-btn-secondary" disabled={busy} onClick={()=>void onAction('proposal')}>Create WordPress draft →</button></div>}
      {pending && <div className="ai-review-actions"><button className="ai-btn ai-btn-secondary" disabled={busy || !value.trim() || !changed} onClick={()=>void onAction('edit',value)}>Save edit</button><button className="ai-btn ai-btn-approve" disabled={busy || changed || !value.trim()} onClick={()=>void onAction('approve')}>✓ Approve</button><button className="ai-btn ai-btn-reject" disabled={busy} onClick={()=>void onAction('reject')}>Reject</button></div>}
    </div>
  </section>;
}
