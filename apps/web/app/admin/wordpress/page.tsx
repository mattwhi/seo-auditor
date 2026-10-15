'use client';
import { useCallback, useEffect, useState } from 'react';
type Project = { id: string; baseUrl: string; enabled: boolean };
export default function WordPressControls() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [infrastructureEnabled, setInfrastructureEnabled] = useState(false);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const load = useCallback(async () => {
    const res = await fetch('/api/admin/wordpress-writes', { cache: 'no-store' });
    if (!res.ok) { setError('Administrator access required'); return; }
    const data = await res.json(); setProjects(data.projects); setInfrastructureEnabled(data.infrastructureEnabled);
  }, []);
  useEffect(() => { void load(); }, [load]);
  async function change(project: Project) {
    setBusy(project.id); setError('');
    try {
      const res = await fetch('/api/admin/wordpress-writes', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ projectId: project.id, enabled: !project.enabled }) });
      if (!res.ok) { setError((await res.json()).error ?? 'Could not update policy'); return; }
      await load();
    } catch { setError('Network error'); } finally { setBusy(''); }
  }
  return <main className="admin-page">
    <div className="admin-heading"><div><span className="admin-eyebrow">Administration / Integrations</span><h1>WordPress write controls</h1><p>Control which projects are permitted to apply approved SEO changes.</p></div></div>
    {error && <p className="admin-alert" role="alert">{error}</p>}
    <section className="admin-card admin-capabilities"><div className="admin-card-heading"><div><h2>Project-scoped write controls</h2><p>Project administrators control write access without editing deployment environment files.</p></div></div>
      <p><span className={'admin-status ' + (infrastructureEnabled ? 'admin-status-accepted' : 'admin-status-revoked')}>{infrastructureEnabled ? 'Admin-managed project policies active' : 'Project policies unavailable'}</span></p>
      <p className="admin-muted">Writes require an enabled project policy, valid WordPress credentials, an approved proposal, a fresh preflight, and WordPress bridge write opt-in. All executions are authenticated and recorded.</p>
    </section>
    <section className="admin-card"><div className="admin-card-heading"><div><h2>Project policies</h2><p>All projects default to write access disabled.</p></div></div>
      <div className="admin-table-scroll"><table className="admin-table"><thead><tr><th>Project</th><th>Policy</th><th>Action</th></tr></thead><tbody>{projects.map(project => <tr key={project.id}><td className="admin-email">{project.baseUrl}</td><td><span className={'admin-status ' + (project.enabled ? 'admin-status-accepted' : 'admin-status-revoked')}>{project.enabled ? 'Enabled' : 'Disabled'}</span></td><td><button type="button" className="admin-secondary" disabled={busy !== ''} onClick={() => void change(project)}>{busy === project.id ? 'Saving…' : project.enabled ? 'Disable writes' : 'Enable project policy'}</button></td></tr>)}</tbody></table></div>
      {projects.length === 0 && <p className="admin-muted">No projects configured.</p>}
    </section>
  </main>;
}
