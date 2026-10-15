 'use client';
import { useCallback, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

type Issue = { id: string; ruleId: string; severity: string; page: { finalUrl: string } | null };
type MappingMatch = { type: string; id: number; link: string };
type IssueMapping = { status: string; reason: string | null; matches: MappingMatch[]; executable: boolean };
type Proposal = { id: string; ruleId: string; pageUrl: string; proposedText: string; status: string; targetType: string; targetId: number; createdAt: string; approvedAt?: string | null };
type Preflight = { id: string; status?: string; originalValue: string; snapshotHash: string; conflict: boolean; createdAt?: string };
type Execution = { errorCode?: string | null; status: string; originalValue: string; appliedValue: string; executedAt?: string; rolledBackAt?: string };
const allowed = new Set(['title.missing','title.too-short','title.too-long','description.missing','description.too-short','description.too-long']);
async function call(action: string, body: Record<string, unknown> = {}) {
  const response = await fetch('/api/remediation', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Remediation-Intent': '1' }, body: JSON.stringify({ action, ...body }), cache: 'no-store' });
  const result = await response.json();
  if (!response.ok) throw new Error([result.error, result.reason].filter(Boolean).join(': ') || `Request failed (${response.status})`);
  return result;
}
async function get(action: string, params: Record<string, string>) {
  const url = new URL('/api/remediation', window.location.origin); url.searchParams.set('action', action);
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
  const response = await fetch(url, { cache: 'no-store' }); const result = await response.json();
  if (!response.ok) throw new Error([result.error, result.reason].filter(Boolean).join(': ') || `Request failed (${response.status})`);
  return result;
}
export default function RemediationWorkspace({ projectId, auditId }: { projectId: string; auditId: string }) {
  const [session, setSession] = useState({ configured: false, authenticated: false, executionConfigured: false });
  const [busy, setBusy] = useState(false); const [error, setError] = useState(''); const [notice, setNotice] = useState('');
  const [proposals, setProposals] = useState<Proposal[]>([]); const [issues, setIssues] = useState<Issue[]>([]);
  const [selectedIssue, setSelectedIssue] = useState(''); const [targetType, setTargetType] = useState('pages'); const [targetId, setTargetId] = useState(''); const [proposedText, setProposedText] = useState('');
  const [selectedProposal, setSelectedProposal] = useState(''); const [preflights, setPreflights] = useState<Preflight[]>([]); const [execution, setExecution] = useState<Execution | null>(null);
  const [filter, setFilter] = useState('all');
  const [confirmAction, setConfirmAction] = useState<'execute' | 'rollback' | 'delete' | null>(null);
  useEffect(() => { if (!confirmAction) return; const close = (event: KeyboardEvent) => { if (event.key === 'Escape' && !busy) setConfirmAction(null); }; document.addEventListener('keydown', close); return () => document.removeEventListener('keydown', close); }, [confirmAction, busy]);
  const [refreshing, setRefreshing] = useState(false);
  const [lastRefreshed, setLastRefreshed] = useState('');
  const [mapping, setMapping] = useState<IssueMapping | null>(null);
  const [mappingLoading, setMappingLoading] = useState(false);
  const [mappingError, setMappingError] = useState('');
  const [mappingConfirmed, setMappingConfirmed] = useState(false);
  // Resolve IDs from the API's existing read-only WordPress mapping endpoint.
  // Never guess a target from a slug or automatically select ambiguous matches.
  useEffect(() => {
    setMapping(null); setMappingError(''); setMappingConfirmed(false);
    setTargetId(''); setTargetType('pages');
    if (!selectedIssue || !auditId) { setMappingLoading(false); return; }
    const controller = new AbortController();
    setMappingLoading(true);
    (async () => {
      try {
        const url = `/api/backend/v1/audits/${encodeURIComponent(auditId)}/wordpress/issue-mapping?issueId=${encodeURIComponent(selectedIssue)}`;
        const response = await fetch(url, { cache: 'no-store', signal: controller.signal });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error ?? `WordPress lookup failed (${response.status})`);
        if (controller.signal.aborted) return;
        setMapping(data as IssueMapping);
        if (data.status === 'matched' && data.matches?.length === 1) {
          const match = data.matches[0] as MappingMatch;
          setTargetId(String(match.id)); setTargetType(match.type);
          setMappingConfirmed(true);
        }
      } catch (e) {
        if (!controller.signal.aborted) setMappingError(e instanceof Error ? e.message : 'WordPress lookup failed');
      } finally { if (!controller.signal.aborted) setMappingLoading(false); }
    })();
    return () => controller.abort();
  }, [auditId, selectedIssue]);
  const chooseMapping = (match: MappingMatch) => {
    setTargetId(String(match.id)); setTargetType(match.type); setMappingConfirmed(true);
  };
  const refresh = useCallback(async () => { if (!projectId) return; setProposals(await get('proposals', { projectId })); }, [projectId]);
  useEffect(() => { get('session', {}).then((s) => setSession(s)).catch(() => {}); }, []);
  useEffect(() => { if (session.authenticated) void refresh().catch((e: Error) => setError(e.message)); }, [session.authenticated, refresh]);
  useEffect(() => { if (!auditId || !session.authenticated) return;
    Promise.all([...allowed].map(async (rule) => {
      const r = await fetch(`/api/backend/v1/audits/${encodeURIComponent(auditId)}/issues?ruleId=${encodeURIComponent(rule)}&limit=100&offset=0`, { cache: 'no-store' });
      if (!r.ok) throw Error('Could not load audit issues');
      const d: { items: Issue[] } = await r.json(); return d.items;
    })).then((groups) => setIssues(groups.flat())).catch((e: Error) => setError(e.message));
  }, [auditId, session.authenticated]);
  const run = async (action: string, body: Record<string, unknown> = {}) => { setBusy(true); setError(''); setNotice(''); try { const result = await call(action, body); setNotice(`${action} completed`); if (action !== 'login') await refresh(); return result; } catch (e) { setError(e instanceof Error ? e.message : String(e)); return null; } finally { setBusy(false); } };
  const inspect = async (id: string) => { setSelectedProposal(id); setPreflights([]); setExecution(null);
    try { const [p, e] = await Promise.all([get('preflights', { proposalId: id }), get('execution', { proposalId: id }).catch(() => null)]); setPreflights(p.items ?? []); setExecution(e); } catch (e) { setError(e instanceof Error ? e.message : String(e)); }
  };
  const refreshAll = async () => {
    setRefreshing(true); setError(''); setNotice('');
    try {
      await refresh();
      if (selectedProposal) await inspect(selectedProposal);
      setLastRefreshed(new Date().toLocaleTimeString());
      setNotice('Proposals and execution history refreshed.');
    } catch (e) { setError(e instanceof Error ? e.message : String(e)); }
    finally { setRefreshing(false); }
  };
  const confirmChange = async () => {
    if (!confirmAction || !chosen || busy) return;
    const action = confirmAction;
    setConfirmAction(null);
    const result = action === 'delete' ? await run('delete', { proposalId: chosen.id, confirm: 'DELETE_UNUSED_PROPOSAL' }) : action === 'execute'
      ? latest && !latest.conflict && chosen.status === 'approved'
        ? await run('execute', { proposalId: chosen.id, preflightId: latest.id, confirm: 'EXECUTE_APPROVED_REMEDIATION' })
        : null
      : execution?.status === 'verified'
        ? await run('rollback', { proposalId: chosen.id, confirm: 'ROLLBACK_REMEDIATION' })
        : null;
    // Always refresh after a write attempt: failures may have persisted needs_review.
    await refreshAll();
    if (result && action === 'delete') { setSelectedProposal(''); setPreflights([]); setExecution(null); }
    if (result) setNotice(action === 'delete' ? 'Unused proposal deleted.' : action === 'execute' ? 'WordPress change verified.' : 'Rollback verified.');
  };
  const chosen = proposals.find((p) => p.id === selectedProposal);
  const latest = preflights[0];
  const counts = Object.fromEntries(['draft','approved','executed','needs_review','rejected','rolled_back'].map((s) => [s, proposals.filter((p) => p.status === s).length]));
  if (!session.configured) return <section className="panel"><h2>Remediation unavailable</h2><p>The server-side remediation operator integration is not configured. Contact an administrator; no credentials are entered in the browser.</p></section>;
  return <section className="comparison-stack remediation-workspace">
    <div className="panel"><div className="section-title"><div><span className="eyebrow">v0.8 · REMEDIATION</span><h2>WordPress SEO remediation</h2><p>Review, approve, preflight and audit metadata changes. Execution requires project admin approval, enabled project policy, valid preflight and WordPress bridge write opt-in.</p></div><div><button type="button" className="remediation-btn remediation-btn-secondary" onClick={() => void refreshAll()} disabled={busy || refreshing}>{refreshing ? "Refreshing…" : "↻ Refresh"}</button>{lastRefreshed && <small className="remediation-hint">Updated {lastRefreshed}</small>}</div></div>
      <div className="remediation-stats">{Object.entries(counts).map(([name, count]) => <div key={name}><strong>{count}</strong><span>{name.replace('_',' ')}</span></div>)}</div>
      {error && <p role="alert" className="remediation-error">{error}</p>}{notice && <p role="status">{notice}</p>}
    </div>
    <div className="panel remediation-create-panel"><div className="section-title"><div><span className="eyebrow">PROPOSE</span><h3>Create SEO fix</h3><p>Choose an eligible audit finding. The backend independently verifies the WordPress object mapping.</p></div></div>
      <div className="remediation-form">
        <label>Issue<select value={selectedIssue} onChange={(e) => setSelectedIssue(e.target.value)}><option value="">Select a finding</option>{issues.map((i) => <option key={i.id} value={i.id}>{i.ruleId} · {i.page?.finalUrl ?? i.id}</option>)}</select></label>
        <label>WordPress content type<input readOnly value={targetId ? (targetType === 'pages' ? 'Page' : targetType === 'posts' ? 'Post' : 'WooCommerce product') : 'Not resolved'} /></label>
        <label>WordPress content ID<input readOnly value={targetId} placeholder={mappingLoading ? 'Looking up ID…' : 'Select a finding'} /></label>
      </div>
      {mappingLoading && <p role="status" className="remediation-hint">Checking the WordPress REST API for an exact URL match…</p>}
      {mappingError && <p role="alert" className="remediation-error">WordPress ID lookup failed: {mappingError}. No ID has been selected.</p>}
      {mapping?.status === 'matched' && mappingConfirmed && <p role="status" className="remediation-hint">Verified WordPress {targetType} #{targetId} — matched against the audited URL. The API will independently validate this mapping when creating the proposal.</p>}
      {mapping && mapping.status !== 'matched' && <div className="remediation-hint" role="status">
        <p>Automatic lookup requires review ({mapping.reason ?? 'no unique match'}). No WordPress ID has been guessed.</p>
        {mapping.matches?.length > 0 ? <label>Choose the correct WordPress content
          <select value={mappingConfirmed ? `${targetType}:${targetId}` : ''} onChange={(e) => { const match = mapping.matches.find((m) => `${m.type}:${m.id}` === e.target.value); if (match) chooseMapping(match); }}>
            <option value="">Select a verified candidate</option>
            {mapping.matches.map((m) => <option key={`${m.type}:${m.id}`} value={`${m.type}:${m.id}`}>{m.type} #{m.id} — {m.link}</option>)}
          </select></label> : <p>Open the page in WordPress and check that its REST API is accessible. A manual ID cannot bypass the server's exact URL verification.</p>}
      </div>}
      <div className="remediation-editor"><label htmlFor="proposed-seo">Proposed SEO title or description</label><textarea id="proposed-seo" rows={3} maxLength={500} value={proposedText} onChange={(e) => setProposedText(e.target.value)} placeholder="Enter a unique, accurate SEO title or description"/><div className="remediation-editor-footer"><span>{proposedText.length}/500 characters</span><span>Review wording before creating a proposal</span></div></div>
      <button className="remediation-btn remediation-btn-primary" disabled={busy || !selectedIssue || !mappingConfirmed || mappingLoading || !Number.isInteger(Number(targetId)) || Number(targetId) <= 0 || proposedText.trim().length < 3} onClick={() => void run('create', { projectId, payload: { auditId, issueId: selectedIssue, targetType, targetId: Number(targetId), proposedText } })}>Create draft proposal</button>
      <p className="remediation-hint">Only supported title and description findings can become proposals. Taxonomy archives and ambiguous WordPress mappings are rejected.</p>
    </div>
    <div className="panel"><div className="section-title"><div><span className="eyebrow">QUEUE</span><h3>Remediation proposals</h3></div><select aria-label="Filter proposal status" value={filter} onChange={(e) => setFilter(e.target.value)}><option value="all">All statuses</option>{Object.keys(counts).map((s) => <option key={s} value={s}>{s}</option>)}</select></div>
      <div className="table-wrap"><table><thead><tr><th>URL / rule</th><th>Target</th><th>Status</th><th>Action</th></tr></thead><tbody>{proposals.filter((p) => filter === 'all' || p.status === filter).map((p) => <tr key={p.id}><td className="url-cell"><strong>{p.ruleId}</strong><div>{p.pageUrl}</div></td><td>{p.targetType} #{p.targetId}</td><td>{p.status}</td><td><div className="remediation-actions"><button type="button" className="remediation-btn remediation-btn-secondary" disabled={busy || refreshing} onClick={() => void inspect(p.id)}>Inspect</button>{['draft','approved','rejected'].includes(p.status) && <button type="button" className="remediation-btn remediation-btn-danger" disabled={busy || refreshing} onClick={() => { setSelectedProposal(p.id); setConfirmAction('delete'); }}>Delete…</button>}</div></td></tr>)}{!proposals.length && <tr><td colSpan={4}>No proposals yet.</td></tr>}</tbody></table></div>
    </div>
    {chosen && <div className="panel"><div className="section-title"><div><span className="eyebrow">SELECTED PROPOSAL</span><h3>{chosen.ruleId} · {chosen.status}</h3><p>{chosen.pageUrl}</p></div></div>
      <p><strong>Proposed replacement</strong></p><div className="remediation-value">{chosen.proposedText}</div>
      {chosen.status === 'draft' && <div className="remediation-actions"><button className="remediation-btn remediation-btn-primary" disabled={busy} onClick={() => void run('approve', { proposalId: chosen.id })}>Approve</button><button className="remediation-btn remediation-btn-danger" disabled={busy} onClick={() => void run('reject', { proposalId: chosen.id })}>Reject</button></div>}
      {chosen.status === 'approved' && <button className="remediation-btn remediation-btn-secondary" disabled={busy} onClick={async () => { const result = await run('preflight', { proposalId: chosen.id }); if (result) await inspect(chosen.id); }}>Run read-only preflight</button>}
      <h4>Preflight snapshots</h4>{preflights.length ? preflights.map((p) => <div className="remediation-snapshot" key={p.id}><p><strong>{p.conflict ? 'Conflict — blocked' : 'Snapshot captured'}</strong> · {p.createdAt ? new Date(p.createdAt).toLocaleString() : p.id}</p><p>Original metadata:</p><div className="remediation-value">{p.originalValue || '(empty)'}</div><small>SHA-256: {p.snapshotHash}</small></div>) : <p>No preflight history.</p>}
      <h4>Execution history</h4>{execution ? <div><p>Status: <strong>{execution.status}</strong></p>{execution.errorCode && <p role="alert" className="remediation-error">Failure reason: <code>{execution.errorCode}</code>. Review the live WordPress value before any retry.</p>}<p>Original: {execution.originalValue || '(empty)'}</p><p>Applied: {execution.appliedValue}</p><p>Executed: {execution.executedAt ?? '—'} · Rolled back: {execution.rolledBackAt ?? '—'}</p></div> : <p>No execution record.</p>}
      <div className="remediation-actions">
        {chosen.status === 'approved' && latest && !latest.conflict && <button type="button" className="remediation-btn remediation-btn-primary" disabled={busy || refreshing} onClick={() => setConfirmAction('execute')}>Update WordPress…</button>}
        {execution?.status === 'verified' && <button type="button" className="remediation-btn remediation-btn-danger" disabled={busy || refreshing} onClick={() => setConfirmAction('rollback')}>Rollback change…</button>}
      </div>
      {chosen.status === 'needs_review' && <p role="alert" className="remediation-error">This proposal requires manual reconciliation. Compare its live WordPress metadata before creating a new proposal; retries are blocked.</p>}
      <p className="remediation-hint">Execution uses your authenticated administrator session and project policy; the WordPress bridge must independently allow writes. Preflight never changes WordPress.</p>
    </div>}
    {confirmAction && chosen && typeof document !== 'undefined' && createPortal(<div className="remediation-modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget && !busy) setConfirmAction(null); }}>
      <div role="alertdialog" aria-modal="true" aria-labelledby="remediation-confirm-title" aria-describedby="remediation-confirm-description" className="remediation-modal">
        <h3 id="remediation-confirm-title">{confirmAction === 'delete' ? 'Delete unused proposal?' : confirmAction === 'execute' ? 'Confirm WordPress update' : 'Confirm WordPress rollback'}</h3>
        <p id="remediation-confirm-description">{confirmAction === 'delete' ? 'This permanently deletes an unused proposal, not the WordPress page. Executed or needs-review proposals cannot be deleted.' : `This action will ${confirmAction === 'execute' ? 'update live WordPress SEO metadata' : 'restore the original WordPress SEO metadata'} for the following page.`}</p>
        <p><strong>Page</strong><span className="remediation-modal-url">{chosen.pageUrl}</span></p>
        <p><strong>Field</strong> {chosen.ruleId.startsWith('description.') ? 'Rank Math description' : 'Rank Math title'}</p>
        <p><strong>Current snapshot</strong></p>
        <div className="remediation-value">{latest?.originalValue || '(empty)'}</div>
        <p><strong>{confirmAction === 'execute' ? 'Proposed value' : 'Original value to restore'}</strong></p>
        <div className="remediation-value">{confirmAction === 'delete' ? chosen.proposedText : confirmAction === 'execute' ? chosen.proposedText : execution?.originalValue || '(empty)'}</div>
        <div className="remediation-actions">
          <button type="button" className="remediation-btn remediation-btn-secondary" disabled={busy} onClick={() => setConfirmAction(null)}>Cancel</button>
          <button type="button" className={`remediation-btn ${confirmAction === 'execute' ? 'remediation-btn-primary' : 'remediation-btn-danger'}`} disabled={busy} onClick={() => void confirmChange()}>{busy ? 'Working…' : confirmAction === 'delete' ? 'Delete unused proposal' : confirmAction === 'execute' ? 'Confirm and update WordPress' : 'Confirm rollback'}</button>
        </div>
      </div>
    </div>, document.body)}
  </section>;
}
