/**
 * Transactional email via the Resend HTTP API (no SDK dependency in apps/web).
 */

export const SENDER_NAME = 'HHT News';

export type EmailAttachment = { filename: string; content: Buffer };

export type EmailMessage = {
  to: string;
  subject: string;
  text: string;
  html?: string;
  attachments?: EmailAttachment[];
};

export function emailSender(env: Record<string, string | undefined> = process.env): string {
  return (
    env.AUTH_EMAIL_FROM?.trim() ||
    `${SENDER_NAME} <${env.RESEND_FROM_EMAIL?.trim() || 'onboarding@resend.dev'}>`
  );
}

/** Throws when Resend is not configured or rejects the message. */
export async function sendEmail(message: EmailMessage): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  if (!apiKey) throw new Error('RESEND_API_KEY is not set');

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: emailSender(),
      to: message.to,
      subject: message.subject,
      text: message.text,
      ...(message.html ? { html: message.html } : {}),
      ...(message.attachments?.length
        ? {
            attachments: message.attachments.map((a) => ({
              filename: a.filename,
              content: a.content.toString('base64'),
            })),
          }
        : {}),
    }),
  });
  if (!res.ok) {
    throw new Error(`Resend rejected the email: ${res.status} ${await res.text()}`);
  }
}
