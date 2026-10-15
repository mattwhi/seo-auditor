'use client';
import { useCallback, useEffect, useState } from 'react';
type Values = Record<string, number | boolean>;
const fields = [
  { key: 'crawler.pageConcurrency', title: 'Concurrent page requests', help: 'Per-crawl page concurrency (1–12).', type: 'number', min: 1, max: 12, group: 'Crawler' },
  { key: 'crawler.maxUrls', title: 'Maximum pages per audit', help: 'Upper limit for new audits (1–10,000); deployment ceiling still applies.', type: 'number', min: 1, max: 10000, group: 'Crawler' },
  { key: 'crawler.requestTimeoutMs', title: 'Request timeout (ms)', help: 'Per-request timeout (1,000–60,000 ms); deployment ceiling still applies.', type: 'number', min: 1000, max: 60000, group: 'Crawler' },
  { key: 'crawler.maxRetries', title: 'Maximum retries', help: 'Retry attempts (0–5); deployment ceiling still applies.', type: 'number', min: 0, max: 5, group: 'Crawler' },
  { key: 'crawler.minDelayMs', title: 'Minimum request delay (ms)', help: 'Polite delay between requests (100–10,000 ms).', type: 'number', min: 100, max: 10000, group: 'Crawler' },
  { key: 'performance.enabled', title: 'PageSpeed measurement', help: 'Run PageSpeed measurements after crawls, only when infrastructure permits.', type: 'checkbox', group: 'Performance' },
  { key: 'performance.maxPages', title: 'Pages sampled per audit', help: 'Representative pages (1–4).', type: 'number', min: 1, max: 4, group: 'Performance' },
  { key: 'activity.retentionDays', title: 'Activity retention (days)', help: 'Archive administrative activity older than this period (default 30). Records are retained, not deleted.', type: 'number', min: 1, max: 365, group: 'Activity' },
  { key: 'activity.autoArchive', title: 'Automatic daily archiving', help: 'Archive eligible activity daily while the worker is running.', type: 'checkbox', group: 'Activity' },
  { key: 'security.invitationExpiryHours', title: 'Invitation expiry (hours)', help: 'Lifetime of new one-time invitation links (1–168 hours).', type: 'number', min: 1, max: 168, group: 'Security' },
] as const;
export default function SettingsPage() {
  const [values, setValues] = useState<Values>({});
  const [original, setOriginal] = useState<Values>({});
  const [safeguards, setSafeguards] = useState({ wordpressWrites: false, performanceInfrastructureEnabled: false });
  const [busy, setBusy] = useState('');
  const [message, setMessage] = useState('');
  const load = useCallback(async () => {
    const response = await fetch('/api/admin/settings', { cache: 'no-store' });
    if (!response.ok) { setMessage('Administrator access required.'); return; }
    const data = await response.json(); setValues(data.settings); setOriginal(data.settings); setSafeguards(data.safeguards);
  }, []);
  useEffect(() => { void load(); }, [load]);
  async function save(key: string) {
    setBusy(key); setMessage('');
    try {
      const response = await fetch('/api/admin/settings', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ key, value: values[key] }) });
      if (!response.ok) { const data = await response.json(); setMessage(data.error ?? 'Save failed'); return; }
      await load(); setMessage('Setting saved and recorded in administration history.');
    } catch { setMessage('Network error while saving.'); } finally { setBusy(''); }
  }
  return <main className="admin-page"><div className="admin-heading"><div><span className="admin-eyebrow">Administration / Configuration</span><h1>Application settings</h1><p>Operational controls saved in PostgreSQL. Changes apply to new work without rebuilding images.</p></div></div>
    <section className="admin-card"><div className="admin-card-heading"><div><h2>Infrastructure safeguards</h2><p>These are deployment safety limits, not application switches. Configure through reviewed GitHub releases.</p></div></div><div className="settings-content"><p>WordPress writes: <span className={'admin-status '+(safeguards.wordpressWrites?'admin-status-accepted':'admin-status-pending')}>{safeguards.wordpressWrites?'Infrastructure permitted':'Not enabled by this deployment'}</span></p><p>PageSpeed: <span className={'admin-status '+(safeguards.performanceInfrastructureEnabled?'admin-status-accepted':'admin-status-pending')}>{safeguards.performanceInfrastructureEnabled?'Infrastructure permitted':'Not enabled by this deployment'}</span></p><p className="admin-muted">Database credentials, encryption keys, Docker networking and deployment permissions stay in GitHub/infrastructure secrets.</p></div></section>
    {message && <p className="settings-message" role="status">{message}</p>}
    {['Crawler','Performance','Security','Activity'].map(group => <section key={group} className="admin-card"><div className="admin-card-heading"><div><h2>{group}</h2><p>Changes are audited and applied to subsequent operations.</p></div></div><div className="settings-content">{fields.filter(field => field.group === group).map(field => <div key={field.key} className="settings-field"><div><label htmlFor={field.key}>{field.title}</label><p className="admin-muted">{field.help}</p></div><div className="settings-actions">{field.type === 'checkbox' ? <input id={field.key} type="checkbox" checked={values[field.key] === true} onChange={e => setValues(prev => ({ ...prev, [field.key]: e.target.checked }))} /> : <input id={field.key} type="number" min={field.min} max={field.max} value={values[field.key] === undefined ? '' : String(values[field.key])} onChange={e => setValues(prev => ({ ...prev, [field.key]: Number(e.target.value) }))} />}<button className="admin-primary" type="button" disabled={busy !== '' || values[field.key] === undefined || values[field.key] === original[field.key]} onClick={() => void save(field.key)}>{busy === field.key ? 'Saving…' : 'Save'}</button></div></div>)}</div></section>)}
  </main>;
}
