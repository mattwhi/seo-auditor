 'use client';
import { useCallback, useEffect, useState } from 'react';

type Issue = { id: string; ruleId: string; severity: string; page: { finalUrl: string } | null };
type Proposal = { id: string; ruleId: string; pageUrl: string; proposedText: string; status: string; targetType: string; targetId: number; createdAt: string; approvedAt?: string | null };
type Preflight = { id: string; status?: string; originalValue: string; snapshotHash: string; conflict: boolean; createdAt?: string };
type Execution = { status: string; originalValue: string; appliedValue: string; executedAt?: string; rolledBackAt?: string };
const allowed = new Set(['title.missing','title.too-short','title.too-long','description.missing','description.too-short','description.too-long']);
async function call(action: string, body: Record<string, unknown> = {}) {
  const response = await fetch('/api/remediation', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Remediation-Intent': '1' }, body: JSON.stringify({ action, ...body }), cache: 'no-store' });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error ?? `Request failed (${response.status})`);
  return result;
}
async function get(action: string, params: Record<string, string>) {
  const url = new URL('/api/remediation', window.location.origin); url.searchParams.set('action', action);
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
  const response = await fetch(url, { cache: 'no-store' }); const result = await response.json();
  if (!response.ok) throw new Error(result.error ?? `Request failed (${response.status})`);
  return result;
}
export default function RemediationWorkspace({ projectId, auditId }: { projectId: string; auditId: string }) {
  const [session, setSession] = useState({ configured: false, authenticated: false, executionConfigured: false });
  const [password, setPassword] = useState(''); const [busy, setBusy] = useState(false); const [error, setError] = useState(''); const [notice, setNotice] = useState('');
  const [proposals, setProposals] = useState<Proposal[]>([]); const [issues, setIssues] = useState<Issue[]>([]);
  const [selectedIssue, setSelectedIssue] = useState(''); const [targetType, setTargetType] = useState('pages'); const [targetId, setTargetId] = useState(''); const [proposedText, setProposedText] = useState('');
  const [selectedProposal, setSelectedProposal] = useState(''); const [preflights, setPreflights] = useState<Preflight[]>([]); const [execution, setExecution] = useState<Execution | null>(null);
  const [filter, setFilter] = useState('all');
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
  const inspect = async (id: string) => { setSelectedProposal(id); setPreflights([]); setExecution(null); setError('');
    try { const [p, e] = await Promise.all([get('preflights', { proposalId: id }), get('execution', { proposalId: id }).catch(() => null)]); setPreflights(p.items ?? []); setExecution(e); } catch (e) { setError(e instanceof Error ? e.message : String(e)); }
  };
  const chosen = proposals.find((p) => p.id === selectedProposal);
  const latest = preflights[0];
  const counts = Object.fromEntries(['draft','approved','executed','needs_review','rejected','rolled_back'].map((s) => [s, proposals.filter((p) => p.status === s).length]));
  if (!session.configured) return <section className="panel"><h2>Remediation management</h2><p>Secure operator UI is disabled until the web-only session password, signing secret and API operator token are configured. No browser-held API tokens are permitted.</p></section>;
  if (!session.authenticated) return <section className="panel"><h2>Operator sign in</h2><p>Sign in to review remediation proposals. Credentials are handled server-side in an HttpOnly session.</p><form onSubmit={async (e) => { e.preventDefault(); const r = await run('login', { password }); setPassword(''); if (r) setSession((s) => ({ ...s, authenticated: true })); }}><label htmlFor="remediation-password">Operator password</label><div className="remediation-form"><input id="remediation-password" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required/><button className="primary" disabled={busy}>Sign in</button></div></form>{error && <p role="alert">{error}</p>}</section>;
  return <section className="comparison-stack remediation-workspace">
    <div className="panel"><div className="section-title"><div><span className="eyebrow">v0.8 · REMEDIATION</span><h2>WordPress SEO remediation</h2><p>Review, approve, preflight and audit metadata changes. Execution is separately gated and disabled unless explicitly enabled on the API and WordPress bridge.</p></div><div><button onClick={() => void refresh()} disabled={busy}>Refresh</button> <button onClick={async () => { await call('logout'); setSession((s) => ({ ...s, authenticated: false })); setProposals([]); }}>Sign out</button></div></div>
      <div className="remediation-stats">{Object.entries(counts).map(([name, count]) => <div key={name}><strong>{count}</strong><span>{name.replace('_',' ')}</span></div>)}</div>
      {error && <p role="alert" className="remediation-error">{error}</p>}{notice && <p role="status">{notice}</p>}
    </div>
    <div className="panel"><div className="section-title"><div><span className="eyebrow">PROPOSE</span><h3>Create SEO fix</h3><p>Choose an eligible audit finding. The backend independently verifies the WordPress object mapping.</p></div></div>
      <div className="remediation-form"><label>Issue<select value={selectedIssue} onChange={(e) => setSelectedIssue(e.target.value)}><option value="">Select a finding</option>{issues.map((i) => <option key={i.id} value={i.id}>{i.ruleId} · {i.page?.finalUrl ?? i.id}</option>)}</select></label><label>Content type<select value={targetType} onChange={(e) => setTargetType(e.target.value)}><option value="pages">Page</option><option value="posts">Post</option><option value="product">WooCommerce product</option></select></label><label>Verified WordPress ID<input type="number" min="1" value={targetId} onChange={(e) => setTargetId(e.target.value)} placeholder="e.g. 161" /></label></div>
      <label htmlFor="proposed-seo">Proposed SEO title or description</label><textarea id="proposed-seo" rows={3} maxLength={500} value={proposedText} onChange={(e) => setProposedText(e.target.value)} placeholder="Enter a unique, accurate SEO title or description"/><p>{proposedText.length}/500 characters</p>
      <button className="primary" disabled={busy || !selectedIssue || !Number.isInteger(Number(targetId)) || Number(targetId) <= 0 || proposedText.trim().length < 3} onClick={() => void run('create', { projectId, payload: { auditId, issueId: selectedIssue, targetType, targetId: Number(targetId), proposedText } })}>Create draft proposal</button>
      <p className="remediation-hint">Only supported title and description findings can become proposals. Taxonomy archives and ambiguous WordPress mappings are rejected.</p>
    </div>
    <div className="panel"><div className="section-title"><div><span className="eyebrow">QUEUE</span><h3>Remediation proposals</h3></div><select aria-label="Filter proposal status" value={filter} onChange={(e) => setFilter(e.target.value)}><option value="all">All statuses</option>{Object.keys(counts).map((s) => <option key={s} value={s}>{s}</option>)}</select></div>
      <div className="table-wrap"><table><thead><tr><th>URL / rule</th><th>Target</th><th>Status</th><th>Action</th></tr></thead><tbody>{proposals.filter((p) => filter === 'all' || p.status === filter).map((p) => <tr key={p.id}><td className="url-cell"><strong>{p.ruleId}</strong><div>{p.pageUrl}</div></td><td>{p.targetType} #{p.targetId}</td><td>{p.status}</td><td><button onClick={() => void inspect(p.id)}>Inspect</button></td></tr>)}{!proposals.length && <tr><td colSpan={4}>No proposals yet.</td></tr>}</tbody></table></div>
    </div>
    {chosen && <div className="panel"><div className="section-title"><div><span className="eyebrow">SELECTED PROPOSAL</span><h3>{chosen.ruleId} · {chosen.status}</h3><p>{chosen.pageUrl}</p></div></div>
      <p><strong>Proposed replacement</strong></p><div className="remediation-value">{chosen.proposedText}</div>
      {chosen.status === 'draft' && <div className="remediation-actions"><button className="primary" disabled={busy} onClick={() => void run('approve', { proposalId: chosen.id })}>Approve</button><button disabled={busy} onClick={() => void run('reject', { proposalId: chosen.id })}>Reject</button></div>}
      {chosen.status === 'approved' && <button disabled={busy} onClick={async () => { const result = await run('preflight', { proposalId: chosen.id }); if (result) await inspect(chosen.id); }}>Run read-only preflight</button>}
      <h4>Preflight snapshots</h4>{preflights.length ? preflights.map((p) => <div className="remediation-snapshot" key={p.id}><p><strong>{p.conflict ? 'Conflict — blocked' : 'Snapshot captured'}</strong> · {p.createdAt ? new Date(p.createdAt).toLocaleString() : p.id}</p><p>Original metadata:</p><div className="remediation-value">{p.originalValue || '(empty)'}</div><small>SHA-256: {p.snapshotHash}</small></div>) : <p>No preflight history.</p>}
      <h4>Execution history</h4>{execution ? <div><p>Status: <strong>{execution.status}</strong></p><p>Original: {execution.originalValue || '(empty)'}</p><p>Applied: {execution.appliedValue}</p><p>Executed: {execution.executedAt ?? '—'} · Rolled back: {execution.rolledBackAt ?? '—'}</p></div> : <p>No execution record.</p>}
      {session.executionConfigured && chosen.status === 'approved' && latest && !latest.conflict && <button disabled={busy} onClick={async () => { if (window.confirm('Execute the approved metadata change? This may modify WordPress. Confirm only on staging after checking the snapshot.')) { const result = await run('execute', { proposalId: chosen.id, preflightId: latest.id, confirm: 'EXECUTE_APPROVED_REMEDIATION' }); if (result) await inspect(chosen.id); } }}>Execute approved change (separately gated)</button>}
      {session.executionConfigured && execution?.status === 'verified' && <button disabled={busy} onClick={async () => { if (window.confirm('Restore original SEO metadata? This modifies WordPress.')) { const result = await run('rollback', { proposalId: chosen.id, confirm: 'ROLLBACK_REMEDIATION' }); if (result) await inspect(chosen.id); } }}>Rollback verified change</button>}
      <p className="remediation-hint">Execution requires a separate server-side token, API origin allowlist, and WordPress bridge write opt-in. Preflight alone never changes WordPress.</p>
    </div>}
  </section>;
}
