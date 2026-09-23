'use client';

/** Clears the email-code session cookie; Payload's own logout only knows its JWT cookie. */
export function LogoutButton() {
  return (
    <button
      type="button"
      className="nav__log-out"
      aria-label="Log out"
      title="Log out"
      onClick={async () => {
        await fetch('/api/auth/logout', { method: 'POST', credentials: 'same-origin' });
        // Full reload (not router.push) so Payload drops its client-side auth state.
        window.location.assign(new URL('/admin/login', window.location.origin).href);
      }}
      style={{ background: 'none', border: 0, cursor: 'pointer', color: 'inherit', padding: 0 }}
    >
      Log out
    </button>
  );
}
