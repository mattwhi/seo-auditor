'use client';
import { useCallback, useEffect, useState } from 'react';
type Project = {
  id: string;
  name: string;
  baseUrl: string;
  wordpressEnabled: boolean;
  wordpressSiteUrl: string;
  searchConsoleSiteUrl: string;
  ga4PropertyId: string;
  wordpressCredentialsConfigured: boolean;
  googleCredentialsConfigured: boolean;
  googleAccountEmail: string | null;
};
type TestResult = { ok: boolean; message: string; wordpress?: boolean; wooCommerce?: boolean };
type Safeguards = {
  wordpress: boolean;
  google: boolean;
  googleCredentials: null;
  wordpressCredentials: null;
};
export default function IntegrationsPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [googleJson, setGoogleJson] = useState<Record<string, string>>({});
  const [credentials, setCredentials] = useState<
    Record<string, { username: string; applicationPassword: string }>
  >({});
  const [results, setResults] = useState<Record<string, TestResult>>({});
  const [, setSafeguards] = useState<Safeguards | null>(null);
  const [busy, setBusy] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const load = useCallback(async () => {
    const response = await fetch('/api/admin/integrations', { cache: 'no-store' });
    if (!response.ok) {
      setError('Administrator access required');
      return;
    }
    const data = (await response.json()) as { projects: Project[]; safeguards: Safeguards };
    setProjects(data.projects);
    setSafeguards(data.safeguards);
  }, []);
  useEffect(() => {
    void load();
  }, [load]);
  function update(id: string, key: keyof Project, value: string | boolean) {
    setProjects((items) => items.map((p) => (p.id === id ? { ...p, [key]: value } : p)));
  }
  async function test(
    project: Project,
    kind: 'wordpress' | 'wordpress-auth' | 'search-console' | 'analytics',
  ) {
    const key = `${project.id}:${kind}`;
    setBusy(key);
    setError('');
    try {
      const response = await fetch(
        `/api/admin/integrations/test?projectId=${encodeURIComponent(project.id)}&kind=${kind}`,
        { cache: 'no-store' },
      );
      const data = (await response.json()) as TestResult;
      setResults((current) => ({
        ...current,
        [key]: {
          ok: response.ok && data.ok,
          message: data.message ?? 'Connection test failed',
          wordpress: data.wordpress,
          wooCommerce: data.wooCommerce,
        },
      }));
    } catch {
      setResults((current) => ({
        ...current,
        [key]: { ok: false, message: 'Could not reach the connection test service' },
      }));
    } finally {
      setBusy('');
    }
  }
  async function saveCredentials(project: Project) {
    setBusy(`${project.id}:credentials`);
    setError('');
    setMessage('');
    const value = credentials[project.id];
    try {
      const response = await fetch('/api/admin/integrations/credentials', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId: project.id,
          username: value?.username,
          applicationPassword: value?.applicationPassword,
        }),
      });
      const result = await response.json();
      if (!response.ok) {
        setError(result.error ?? 'Credential save failed');
        return;
      }
      setCredentials((current) => ({
        ...current,
        [project.id]: { username: '', applicationPassword: '' },
      }));
      setMessage('Credentials encrypted and saved. Test authenticated access before remediation.');
      await load();
    } catch {
      setError('Could not save credentials');
    } finally {
      setBusy('');
    }
  }
  async function saveGoogleCredentials(project: Project) {
    const key = `${project.id}:google-credentials`;
    setBusy(key);
    setError('');
    setMessage('');
    try {
      const response = await fetch('/api/admin/integrations/google-credentials', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId: project.id,
          serviceAccountJson: googleJson[project.id] ?? '',
        }),
      });
      const result = (await response.json()) as { error?: string };
      if (!response.ok) {
        setError(result.error ?? 'Google credential save failed');
        return;
      }
      setGoogleJson((current) => ({ ...current, [project.id]: '' }));
      setMessage(
        'Google service account saved securely. Grant the service account access to the Search Console and GA4 properties, then test both connections.',
      );
      await load();
    } catch {
      setError('Could not save Google credentials');
    } finally {
      setBusy('');
    }
  }
  async function removeGoogleCredentials(project: Project) {
    if (!window.confirm(`Remove Google credentials for ${project.name || project.baseUrl}?`))
      return;
    setBusy(`${project.id}:google-credentials`);
    setError('');
    try {
      const response = await fetch('/api/admin/integrations/google-credentials', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId: project.id }),
      });
      if (!response.ok) {
        setError('Could not remove Google credentials');
        return;
      }
      setMessage('Google credentials removed');
      await load();
    } catch {
      setError('Could not remove Google credentials');
    } finally {
      setBusy('');
    }
  }
  async function deleteCredentials(project: Project) {
    setBusy(`${project.id}:credentials`);
    setError('');
    try {
      const response = await fetch('/api/admin/integrations/credentials', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId: project.id }),
      });
      if (!response.ok) {
        setError('Could not remove credentials');
        return;
      }
      setMessage('WordPress credentials removed');
      await load();
    } catch {
      setError('Could not remove credentials');
    } finally {
      setBusy('');
    }
  }
  async function save(project: Project) {
    setBusy(project.id);
    setMessage('');
    setError('');
    try {
      const response = await fetch('/api/admin/integrations', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId: project.id,
          wordpressEnabled: project.wordpressEnabled,
          wordpressSiteUrl:
            project.wordpressSiteUrl.trim() ||
            (project.wordpressEnabled ? new URL('/', project.baseUrl).href : ''),
          searchConsoleSiteUrl: project.searchConsoleSiteUrl.trim(),
          ga4PropertyId: project.ga4PropertyId.trim(),
        }),
      });
      if (!response.ok) {
        const body = await response.json();
        const messages: Record<string, string> = {
          invalid_mapping:
            'One or more integration fields are invalid. Check the WordPress URL, Search Console property and numeric GA4 property ID.',
          wordpress_origin_mismatch:
            'WordPress URL must match this project’s HTTPS origin and end with a slash (/).',
          invalid_wordpress_url: 'Enter a valid HTTPS WordPress site URL.',
          invalid_search_console_property:
            'Use an HTTPS Search Console URL-prefix property or sc-domain:example.com.',
          invalid_ga4_property_id: 'GA4 property ID must contain digits only.',
        };
        setError(messages[body.error] ?? body.error ?? 'Save failed');
        return;
      }
      setResults({});
      setMessage(
        `Saved integration mappings for ${project.baseUrl}. Run connection tests to verify access.`,
      );
      await load();
    } catch {
      setError('Network error while saving');
    } finally {
      setBusy('');
    }
  }
  return (
    <main className="admin-page">
      <div className="admin-heading">
        <div>
          <span className="admin-eyebrow">Administration / Integrations</span>
          <h1>Project integrations &amp; secrets</h1>
          <p>
            Enter and rotate WordPress Application Passwords here. Each website has its own
            encrypted credentials and write policy. No per-site environment variables or source
            edits.
          </p>
        </div>
      </div>
      {error && (
        <p className="admin-alert" role="alert">
          {error}
        </p>
      )}
      {message && (
        <p className="settings-message" role="status">
          {message}
        </p>
      )}
      <section className="admin-card admin-capabilities">
        <div className="admin-card-heading">
          <div>
            <h2>How to connect a website</h2>
            <p>
              Project mappings are managed below. Connection availability is verified by the API
              when you open the relevant audit tab.
            </p>
          </div>
        </div>
        <div className="settings-content">
          <p>
            1. Enable WordPress discovery and save the website URL. 2. Enter the WordPress username
            and Application Password below and save. 3. Test authenticated access. 4. Open WordPress
            controls to enable approved writes for this project.
          </p>
          <p className="admin-muted">
            Credentials are never returned to the browser after saving. WordPress writes require an
            administrator, an enabled project policy, approval, fresh preflight and WordPress bridge
            write opt-in.
          </p>
        </div>
      </section>
      {projects.map((project) => (
        <section key={project.id} className="admin-card admin-integrations-card">
          <div className="admin-card-heading">
            <div>
              <h2>{project.name || project.baseUrl}</h2>
              <p>{project.baseUrl}</p>
            </div>
          </div>
          <div className="settings-content">
            <div className="settings-field">
              <div>
                <label htmlFor={`wp-${project.id}`}>Enable WordPress discovery</label>
                <p className="admin-muted">Read-only WordPress and WooCommerce detection.</p>
              </div>
              <input
                id={`wp-${project.id}`}
                type="checkbox"
                checked={project.wordpressEnabled}
                onChange={(e) => update(project.id, 'wordpressEnabled', e.target.checked)}
              />
            </div>
            <div className="settings-field">
              <div>
                <label htmlFor={`wpurl-${project.id}`}>WordPress site URL</label>
                <p className="admin-muted">Must match the project HTTPS origin and end in /.</p>
              </div>
              <input
                id={`wpurl-${project.id}`}
                type="url"
                placeholder="https://example.com/"
                value={project.wordpressSiteUrl}
                onChange={(e) => update(project.id, 'wordpressSiteUrl', e.target.value)}
              />
            </div>
            <div className="settings-field">
              <div>
                <strong>WordPress credentials / secrets</strong>
                <p className="admin-muted">
                  {project.wordpressCredentialsConfigured
                    ? 'Application Password saved (encrypted). Enter new credentials to rotate.'
                    : 'No Application Password saved. Required for remediation preflight and execution.'}{' '}
                  Save the WordPress site mapping above first. Application Passwords are created
                  under WordPress → Users → Profile → Application Passwords.
                </p>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <input
                  type="text"
                  aria-label="WordPress username"
                  autoComplete="off"
                  placeholder="WordPress username"
                  value={credentials[project.id]?.username ?? ''}
                  onChange={(e) =>
                    setCredentials((current) => ({
                      ...current,
                      [project.id]: {
                        username: e.target.value,
                        applicationPassword: current[project.id]?.applicationPassword ?? '',
                      },
                    }))
                  }
                />
                <input
                  type="password"
                  aria-label="WordPress application password"
                  autoComplete="new-password"
                  placeholder="WordPress application password"
                  value={credentials[project.id]?.applicationPassword ?? ''}
                  onChange={(e) =>
                    setCredentials((current) => ({
                      ...current,
                      [project.id]: {
                        username: current[project.id]?.username ?? '',
                        applicationPassword: e.target.value,
                      },
                    }))
                  }
                />
                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    type="button"
                    disabled={busy !== ''}
                    onClick={() => void saveCredentials(project)}
                  >
                    Save credentials
                  </button>
                  {project.wordpressCredentialsConfigured && (
                    <button
                      type="button"
                      disabled={busy !== ''}
                      onClick={() => void deleteCredentials(project)}
                    >
                      Remove credentials
                    </button>
                  )}
                </div>
              </div>
            </div>
            <div className="settings-field">
              <div>
                <strong>Write permissions</strong>
                <p className="admin-muted">
                  Write permissions are managed per project, not through .env files.
                </p>
              </div>
              <a href="/admin/wordpress">Manage project write permissions →</a>
            </div>
            <div className="settings-field settings-field--stacked">
              <div>
                <strong>Google Search Console &amp; Analytics credentials</strong>
                <p className="admin-muted">
                  {project.googleCredentialsConfigured
                    ? `Service account saved: ${project.googleAccountEmail}. Paste a new JSON key to rotate.`
                    : 'Not connected. Paste a Google Cloud service-account JSON key for this project.'}{' '}
                  The key is encrypted and never returned to your browser.
                </p>
                <p className="admin-muted">
                  After saving, grant the service-account email access to your Search Console
                  property and GA4 property (Viewer). Set the properties below and run both tests.
                </p>
              </div>
              <div className="settings-secret-editor">
                <textarea
                  aria-label={`Google service account JSON for ${project.name}`}
                  rows={5}
                  spellCheck={false}
                  placeholder="Paste the complete service-account JSON key here"
                  value={googleJson[project.id] ?? ''}
                  onChange={(e) =>
                    setGoogleJson((current) => ({ ...current, [project.id]: e.target.value }))
                  }
                />
                <div className="settings-button-row">
                  <button
                    type="button"
                    className="admin-primary"
                    disabled={busy !== '' || !(googleJson[project.id] ?? '').trim()}
                    onClick={() => void saveGoogleCredentials(project)}
                  >
                    {busy === `${project.id}:google-credentials`
                      ? 'Saving…'
                      : 'Save Google credentials'}
                  </button>
                  {project.googleCredentialsConfigured && (
                    <button
                      type="button"
                      className="admin-secondary"
                      disabled={busy !== ''}
                      onClick={() => void removeGoogleCredentials(project)}
                    >
                      Remove Google credentials
                    </button>
                  )}
                </div>
              </div>
            </div>
            <div className="settings-field">
              <div>
                <label htmlFor={`gsc-${project.id}`}>Google Search Console property</label>
                <p className="admin-muted">URL prefix or sc-domain:example.com.</p>
              </div>
              <input
                id={`gsc-${project.id}`}
                type="text"
                placeholder="sc-domain:example.com"
                value={project.searchConsoleSiteUrl}
                onChange={(e) => update(project.id, 'searchConsoleSiteUrl', e.target.value)}
              />
            </div>
            <div className="settings-field">
              <div>
                <label htmlFor={`ga-${project.id}`}>Google Analytics 4 property ID</label>
                <p className="admin-muted">Numeric GA4 property ID, not the G- measurement ID.</p>
              </div>
              <input
                id={`ga-${project.id}`}
                type="text"
                inputMode="numeric"
                placeholder="123456789"
                value={project.ga4PropertyId}
                onChange={(e) => update(project.id, 'ga4PropertyId', e.target.value)}
              />
            </div>
            <div className="settings-field">
              <div>
                <strong>Live connection tests</strong>
                <p className="admin-muted">
                  Save changes first. Tests run through the API service; a saved mapping is not
                  proof of access. WordPress discovery is public; authenticated testing verifies the
                  Application Password without making changes.
                </p>
              </div>
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 10,
                  alignItems: 'flex-start',
                }}
              >
                {(
                  [
                    ['wordpress', 'Test WordPress discovery'],
                    ['wordpress-auth', 'Test authenticated WordPress'],
                    ['search-console', 'Test Search Console'],
                    ['analytics', 'Test GA4'],
                  ] as const
                ).map(([kind, label]) => {
                  const key = `${project.id}:${kind}`;
                  const result = results[key];
                  return (
                    <div key={kind}>
                      <button
                        type="button"
                        disabled={busy !== ''}
                        onClick={() => void test(project, kind)}
                      >
                        {busy === key ? 'Testing…' : label}
                      </button>
                      {result && (
                        <p
                          role="status"
                          style={{ marginTop: 6, color: result.ok ? '#86efac' : '#fda4af' }}
                        >
                          {result.ok ? 'Connected: ' : 'Not connected: '}
                          {result.message}
                          {kind === 'wordpress' && result.ok
                            ? ` · WooCommerce ${result.wooCommerce ? 'detected' : 'not detected'}`
                            : ''}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
            <div className="settings-actions">
              <button
                type="button"
                className="admin-primary"
                disabled={busy !== ''}
                onClick={() => void save(project)}
              >
                {busy === project.id ? 'Saving…' : 'Save integrations'}
              </button>
            </div>
          </div>
        </section>
      ))}
      {projects.length === 0 && (
        <section className="admin-card">
          <p>No projects found. Create a project first.</p>
        </section>
      )}
    </main>
  );
}
