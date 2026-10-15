'use client';

import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';

export default function Login() {
  const router = useRouter();
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setLoading(true);
    const form = new FormData(event.currentTarget);
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: form.get('email'), password: form.get('password') }),
      });
      if (!response.ok) {
        setError(response.status === 429 ? 'Too many attempts. Please try again later.' : 'Incorrect email or password.');
        return;
      }
      router.replace('/');
      router.refresh();
    } catch {
      setError('Unable to connect. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return <main className="auth-page">
    <div className="auth-shell">
      <section className="auth-intro" aria-label="SEO Auditor platform">
        <div className="auth-logo"><span className="auth-logo-icon">◈</span> SEO Auditor</div>
        <div className="auth-intro-copy">
          <span className="auth-kicker">TECHNICAL SEO INTELLIGENCE</span>
          <h1>See the whole picture.<br /><span>Improve what matters.</span></h1>
          <p>Crawl, analyse and monitor your websites from one secure workspace. Turn technical findings into measurable improvements.</p>
          <div className="auth-highlights"><span>✓ Technical audits</span><span>✓ Actionable insights</span><span>✓ Continuous monitoring</span></div>
        </div>
        <p className="auth-intro-footer">Open-source SEO auditing platform</p>
      </section>
      <section className="auth-form-panel">
        <div className="auth-card">
          <div className="auth-card-symbol">◈</div>
          <span className="auth-kicker">WELCOME BACK</span>
          <h2>Sign in to your account</h2>
          <p className="auth-description">Enter your credentials to access your SEO workspace.</p>
          <form onSubmit={submit} className="auth-form">
            <label htmlFor="login-email">Email address</label>
            <input id="login-email" name="email" type="email" placeholder="you@company.com" autoComplete="username" required autoFocus />
            <label htmlFor="login-password">Password</label>
            <input id="login-password" name="password" type="password" placeholder="Enter your password" autoComplete="current-password" required />
            {error && <p className="auth-error" role="alert">{error}</p>}
            <button className="auth-submit" disabled={loading} type="submit">{loading ? 'Signing in…' : 'Sign in →'}</button>
          </form>
          <div className="auth-invite-note"><span aria-hidden="true">♢</span><div><strong>Invitation-only access</strong><p>New accounts are created through an administrator invitation.</p></div></div>
        </div>
      </section>
    </div>
  </main>;
}
