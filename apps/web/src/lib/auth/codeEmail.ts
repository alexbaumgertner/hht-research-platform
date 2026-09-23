/**
 * Login code email via the Resend HTTP API (no SDK dependency in apps/web).
 * Without RESEND_API_KEY outside production the code is printed to the server
 * console so local login works; in production a missing key is an error.
 */

const SENDER_NAME = 'HHT News';

export function codeEmail(code: string): { subject: string; text: string; html: string } {
  const text = [
    `Your HHT News admin login code: ${code}`,
    '',
    'It is valid for 10 minutes and works once.',
    'If you did not try to sign in, ignore this email.',
  ].join('\n');
  const html = [
    '<div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;font-size:15px;line-height:1.55;color:#1a1a1a;max-width:32rem">',
    `<p style="margin:0 0 1.25rem;font-weight:600">${SENDER_NAME} — admin</p>`,
    '<p style="margin:0 0 .75rem">Your login code:</p>',
    `<p style="margin:0 0 1.25rem;font-size:30px;font-weight:600;letter-spacing:.18em;font-family:ui-monospace,SFMono-Regular,Menlo,monospace">${code}</p>`,
    '<p style="margin:0">It is valid for 10 minutes and works once.</p>',
    '<p style="margin:1.75rem 0 0;font-size:13px;color:#6b6b6b">If you did not try to sign in, ignore this email.</p>',
    '</div>',
  ].join('');
  return { subject: `Admin login code: ${code}`, text, html };
}

export async function sendCodeEmail(to: string, code: string): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const message = codeEmail(code);

  if (!apiKey) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('RESEND_API_KEY is not set');
    }
    console.info(`\n[auth] RESEND_API_KEY not set — login code for ${to}: ${code}\n`);
    return;
  }

  const from =
    process.env.AUTH_EMAIL_FROM?.trim() ||
    `${SENDER_NAME} <${process.env.RESEND_FROM_EMAIL?.trim() || 'onboarding@resend.dev'}>`;
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from,
      to,
      subject: message.subject,
      text: message.text,
      html: message.html,
    }),
  });
  if (!res.ok) {
    throw new Error(`Resend rejected the email: ${res.status} ${await res.text()}`);
  }
}
