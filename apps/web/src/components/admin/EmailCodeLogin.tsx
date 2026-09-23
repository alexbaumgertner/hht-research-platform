'use client';

import { useState, type FormEvent } from 'react';

/**
 * Admin login: email → 6-digit code by email. Rendered in Payload's
 * `beforeLogin` slot; the password form is gone (local strategy disabled).
 */
export function EmailCodeLogin() {
  const [step, setStep] = useState<'email' | 'code'>('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function post(path: string, body: Record<string, string>) {
    const res = await fetch(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify(body),
    });
    const data = (await res.json().catch(() => ({}))) as { error?: string };
    return { ok: res.ok, error: data.error };
  }

  async function onRequest(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    const result = await post('/api/auth/request-code', { email });
    setBusy(false);
    if (!result.ok) return setError(result.error ?? 'Something went wrong.');
    setStep('code');
  }

  async function onVerify(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    const result = await post('/api/auth/verify-code', { email, code });
    if (!result.ok) {
      setBusy(false);
      return setError(result.error ?? 'Something went wrong.');
    }
    const redirect = new URLSearchParams(window.location.search).get('redirect');
    // Full reload so the admin shell boots with the new session cookie.
    const target =
      redirect && redirect.startsWith('/') && !redirect.startsWith('//') ? redirect : '/admin';
    window.location.assign(new URL(target, window.location.origin).href);
  }

  const field = { display: 'flex', flexDirection: 'column' as const, gap: 8, marginBottom: 16 };
  const input = {
    padding: '10px 12px',
    fontSize: 16,
    borderRadius: 4,
    border: '1px solid var(--theme-elevation-250)',
    background: 'var(--theme-input-bg)',
    color: 'var(--theme-text)',
  };

  return (
    <div style={{ width: '100%', maxWidth: 420 }}>
      {step === 'email' ? (
        <form onSubmit={onRequest}>
          <div style={field}>
            <label htmlFor="otp-email">Email</label>
            <input
              id="otp-email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              style={input}
            />
          </div>
          <button type="submit" className="btn btn--style-primary" disabled={busy}>
            {busy ? 'Sending…' : 'Send login code'}
          </button>
        </form>
      ) : (
        <form onSubmit={onVerify}>
          <p style={{ marginTop: 0 }}>
            If <strong>{email}</strong> is an admin address, a 6-digit code is on its way. It is
            valid for 10 minutes.
          </p>
          <div style={field}>
            <label htmlFor="otp-code">Code</label>
            <input
              id="otp-code"
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="[0-9 ]{6,7}"
              required
              value={code}
              onChange={(e) => setCode(e.target.value)}
              style={{ ...input, letterSpacing: '0.2em' }}
            />
          </div>
          <button type="submit" className="btn btn--style-primary" disabled={busy}>
            {busy ? 'Checking…' : 'Sign in'}
          </button>{' '}
          <button
            type="button"
            className="btn btn--style-secondary"
            onClick={() => {
              setStep('email');
              setCode('');
              setError(null);
            }}
          >
            Use another email
          </button>
        </form>
      )}
      {error ? (
        <p role="alert" style={{ color: 'var(--theme-error-500)', marginTop: 12 }}>
          {error}
        </p>
      ) : null}
    </div>
  );
}
