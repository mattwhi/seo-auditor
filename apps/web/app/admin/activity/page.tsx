 'use client';
import { useEffect, useState } from 'react';
type Event = { id: string; action: string; targetId: string; createdAt: string; actor: { email: string } };
export default function ActivityPage() {
  const [events, setEvents] = useState<Event[]>([]);
  const [error, setError] = useState('');
  const [view, setView] = useState<'active' | 'archived'>('active');
  const [loading, setLoading] = useState(false);
  useEffect(() => { setLoading(true); setError(''); void fetch(`/api/admin/audit-events?view=${view}`, { cache: 'no-store' }).then(async r => {
    if (!r.ok) throw new Error('Administrator access required');
    return r.json();
  }).then(data => setEvents(data.events)).catch(e => setError(e.message)).finally(() => setLoading(false)); }, [view]);
  return <main className="admin-page"><div className="admin-heading"><div><span className="admin-eyebrow">Administration / Security</span><h1>Activity history</h1><p>Recent administrative changes and remediation decisions.</p></div></div>
    {error && <p className="admin-alert" role="alert">{error}</p>}
    <section className="admin-card"><div className="admin-card-heading"><div><h2>Administrative activity</h2><p>Active events are retained for the configured period (30 days by default), then automatically archived daily. Archived records remain available for review.</p></div><div className="admin-activity-controls"><button className={view === 'active' ? 'admin-action active' : 'admin-action'} onClick={() => setView('active')}>Recent activity</button><button className={view === 'archived' ? 'admin-action active' : 'admin-action'} onClick={() => setView('archived')}>Archive</button></div></div>{loading && <p className="admin-muted">Loading activity…</p>}<div className="admin-table-scroll"><table className="admin-table"><thead><tr><th>When</th><th>Administrator</th><th>Action</th><th>Target</th></tr></thead><tbody>{events.map(e => <tr key={e.id}><td>{new Date(e.createdAt).toLocaleString()}</td><td>{e.actor.email}</td><td>{e.action}</td><td>{e.targetId}</td></tr>)}</tbody></table></div>{events.length === 0 && !error && <p className="admin-muted">No activity recorded.</p>}</section>
  </main>;
}
