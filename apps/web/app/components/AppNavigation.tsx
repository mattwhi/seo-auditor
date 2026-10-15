'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

type Account = { email: string; role: 'ADMIN' | 'USER' | 'READ_ONLY' };

export default function AppNavigation() {
  const pathname = usePathname();
  const router = useRouter();
  const [account, setAccount] = useState<Account | null>(null);
  const [signingOut, setSigningOut] = useState(false);
  const publicPage = pathname === '/login' || pathname === '/register';

  useEffect(() => {
    if (publicPage) return;
    const controller = new AbortController();
    fetch('/api/auth/me', { cache: 'no-store', signal: controller.signal })
      .then((res) => res.ok ? res.json() : null)
      .then((data) => { if (!controller.signal.aborted) { setAccount(data?.user ?? null); if (!data?.user) router.replace('/login'); } })
      .catch(() => { if (!controller.signal.aborted) setAccount(null); });
    return () => controller.abort();
  }, [publicPage, router]);

  async function logout() {
    setSigningOut(true);
    try {
      const response = await fetch('/api/auth/logout', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}', credentials: 'same-origin' });
      if (!response.ok) throw new Error('Sign out failed');
      setAccount(null);
      window.location.replace('/login');
    } catch {
      setSigningOut(false);
      window.alert('Could not sign out. Please try again.');
    }
  }

  if (publicPage || !account) return null;
  const admin = account.role === 'ADMIN';
  return <nav className="app-navigation" aria-label="Main navigation">
    <div className="app-navigation-inner">
      <Link href="/" className="app-navigation-brand"><span className="app-brand-mark">◈</span> SEO Auditor</Link>
      <div className="app-navigation-links">
        <Link href="/" className={pathname === '/' ? 'nav-active' : ''}>Dashboard</Link>
        {admin && <>
          <span className="app-nav-divider" aria-hidden="true" />
          <span className="app-nav-section">Administration</span>
          <Link href="/admin/users" className={pathname === '/admin/users' ? 'nav-active' : ''}>Users &amp; roles</Link>
          <Link href="/admin/invitations" className={pathname === '/admin/invitations' ? 'nav-active' : ''}>Invitations</Link>
          <Link href="/admin/settings" className={pathname === "/admin/settings" ? "nav-active" : ""}>Settings</Link>
          <Link href="/admin/activity" className={pathname === "/admin/activity" ? "nav-active" : ""}>Activity</Link>
          <Link href="/admin/integrations" className={pathname === "/admin/integrations" ? "nav-active" : ""}>Integrations &amp; secrets</Link>
          <Link href="/admin/wordpress" className={pathname === '/admin/wordpress' ? 'nav-active' : ''}>WordPress controls</Link>
        </>}
      </div>
      <div className="app-navigation-account">
        <div className="app-account-details"><strong>{account.email}</strong><span>{account.role === 'READ_ONLY' ? 'Read-only' : account.role === 'ADMIN' ? 'Administrator' : 'User'}</span></div>
        <button type="button" className="app-logout" disabled={signingOut} onClick={logout}>{signingOut ? 'Signing out…' : 'Log out ↗'}</button>
      </div>
    </div>
  </nav>;
}
