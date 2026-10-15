'use client';
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
type User = { id: string; email: string; role: string; disabled: boolean };
type Invitation = { id: string; email: string; role: string; expiresAt: string; acceptedAt: string | null; revokedAt: string | null };
type Event = { id: string; action: string; targetId: string; createdAt: string; actor: { email: string } };
export default function UsersAdmin() {
  const [users, setUsers] = useState<User[]>([]);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [events, setEvents] = useState<Event[]>([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const load = useCallback(async () => {
    const res = await fetch('/api/admin/management', { cache: 'no-store' });
    if (!res.ok) { setError('Administrator access required'); return; }
    const result = await res.json(); setUsers(result.users); setInvitations(result.invitations); setEvents(result.events);
  }, []);
  useEffect(() => { void load(); }, [load]);
  async function change(payload: object) {
    setBusy(true); setError('');
    try {
      const res = await fetch('/api/admin/management', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      if (!res.ok) { const result = await res.json(); setError(result.error ?? 'Update failed'); }
      await load();
    } catch { setError('Request failed'); }
    finally { setBusy(false); }
  }
  return <main className="admin-page">
    <div className="admin-heading"><div><span className="admin-eyebrow">Administration / Access management</span><h1>Users &amp; roles</h1><p>Manage account access, pending invitations and administrator activity.</p></div><Link className="admin-primary" href="/admin/invitations">+ Invite a user</Link></div>
    {error && <p className="admin-alert" role="alert">{error}</p>}
    <section className="admin-card"><div className="admin-card-heading"><div><h2>Accounts <span className="admin-count">{users.length}</span></h2><p>Changes to access levels revoke existing sessions.</p></div></div><div className="admin-table-scroll"><table className="admin-table"><thead><tr><th>Email</th><th>Role</th><th>Status</th><th>Action</th></tr></thead><tbody>
    {users.map(u => <UserRow key={u.id} user={u} busy={busy} save={change}/>)}</tbody></table></div></section>
    <section className="admin-card"><div className="admin-card-heading"><div><h2>Invitations <span className="admin-count">{invitations.length}</span></h2><p>Review invitation status and revoke unused links.</p></div><Link href="/admin/invitations" className="admin-secondary">New invitation</Link></div><div className="admin-table-scroll"><table className="admin-table"><thead><tr><th>Email</th><th>Role</th><th>Status</th><th>Action</th></tr></thead><tbody>
    {invitations.map(i => { const pending = !i.acceptedAt && !i.revokedAt && new Date(i.expiresAt) > new Date(); const status = i.acceptedAt ? 'Accepted' : i.revokedAt ? 'Revoked' : pending ? 'Pending' : 'Expired'; return <tr key={i.id}><td className="admin-email">{i.email}</td><td>{i.role.replace('_','-')}</td><td><span className={'admin-status admin-status-'+status.toLowerCase()}>{status}</span></td><td>{pending ? <button className="admin-secondary" disabled={busy} onClick={() => change({action:'revoke_invitation',id:i.id})}>Revoke</button> : <span className="admin-muted">—</span>}</td></tr>; })}</tbody></table></div></section>
    <section className="admin-card"><div className="admin-card-heading"><div><h2>Recent administration activity</h2><p>A record of user and invitation changes.</p></div></div><div className="admin-activity">{events.length ? events.map(e => <div className="admin-event" key={e.id}><span className="admin-event-dot"/><div><strong>{e.action.replaceAll('.', ' · ')}</strong><p>{e.actor.email} · {new Date(e.createdAt).toLocaleString()}</p></div><span className="admin-event-id" title={e.targetId}>{e.targetId.slice(0, 10)}…</span></div>) : <p className="admin-muted">No administration activity yet.</p>}</div></section>
  </main>;
}
function UserRow({user, busy, save}: {user:User;busy:boolean;save:(payload:object)=>Promise<void>}) {
  const [role,setRole]=useState(user.role); const [disabled,setDisabled]=useState(user.disabled);
  useEffect(()=>{setRole(user.role);setDisabled(user.disabled)},[user.role,user.disabled]);
  return <tr><td className="admin-email">{user.email}</td><td><select aria-label={`Role for ${user.email}`} value={role} onChange={e=>setRole(e.target.value)}><option value="ADMIN">Admin</option><option value="USER">User</option><option value="READ_ONLY">Read-only</option></select></td><td><label className="admin-check-label"><input type="checkbox" checked={disabled} onChange={e=>setDisabled(e.target.checked)}/><span className={disabled ? 'admin-status admin-status-revoked' : 'admin-status admin-status-accepted'}>{disabled ? 'Disabled' : 'Active'}</span></label></td><td><button className="admin-secondary" disabled={busy || (role===user.role && disabled===user.disabled)} onClick={()=>save({action:'update_user',id:user.id,role,disabled})}>Save</button></td></tr>;
}
