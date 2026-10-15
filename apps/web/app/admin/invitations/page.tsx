'use client';
import Link from 'next/link';
import { FormEvent, useState } from 'react';

export default function Invitations() {
  const [link, setLink] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault(); setError(''); setLink(''); setCopied(false); setLoading(true);
    const form = new FormData(e.currentTarget);
    try {
      const r = await fetch('/api/auth/invite', {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:form.get('email'),role:form.get('role')})});
      if (!r.ok) { setError('Unable to create invitation. Check your administrator access and try again.'); return; }
      setLink((await r.json()).inviteUrl);
    } catch { setError('Unable to connect. Please try again.'); }
    finally { setLoading(false); }
  }
  async function copy() {
    try { await navigator.clipboard.writeText(link); setCopied(true); }
    catch { setError('Clipboard unavailable. Select and copy the invitation link manually.'); }
  }
  return <main className="admin-page">
    <div className="admin-heading"><div><span className="admin-eyebrow">Administration / Invitations</span><h1>Invite a user</h1><p>Send a secure, single-use invitation to join your SEO Auditor workspace.</p></div><Link className="admin-secondary" href="/admin/users">← Users &amp; roles</Link></div>
    <div className="admin-card admin-form-card"><div className="admin-card-heading"><div><h2>New invitation</h2><p>Invitation links expire after 48 hours and can only be used once.</p></div><span className="admin-chip">Invitation only</span></div>
      <form onSubmit={submit} className="admin-form"><label htmlFor="invite-email">Email address</label><input id="invite-email" name="email" type="email" placeholder="colleague@example.com" autoComplete="email" required />
        <label htmlFor="invite-role">Access level</label><select id="invite-role" name="role" defaultValue="READ_ONLY"><option value="READ_ONLY">Read-only — view audits and reports</option><option value="USER">User — run audits and manage projects</option><option value="ADMIN">Admin — manage users and settings</option></select>
        <div className="admin-form-actions"><button className="admin-primary" disabled={loading} type="submit">{loading ? 'Generating…' : 'Generate invitation link'}</button><span>Share the link privately with the recipient.</span></div>
      </form>
      {error && <p className="admin-alert" role="alert">{error}</p>}
      {link && <div className="admin-invite-result"><h3>Invitation created</h3><p>Copy this link now. It will not be displayed again.</p><div className="admin-copy-row"><input aria-label="Invitation link" readOnly value={link} onFocus={e=>e.currentTarget.select()}/><button className="admin-secondary" type="button" onClick={()=>void copy()}>{copied ? 'Copied ✓' : 'Copy link'}</button></div></div>}
    </div>
  </main>;
}
