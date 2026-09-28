/**
 * Transactional email via the Resend HTTP API (no SDK dependency in apps/web).
 * Subscriber issue mail passes its own sender name and must not use `SENDER_NAME`.
 */

export const SENDER_NAME = 'HHT News';

export type EmailAttachment = { filename: string; content: Buffer };

export type EmailMessage = {
  to: string;
  subject: string;
  text: string;
  html?: string;
  attachments?: EmailAttachment[];
  replyTo?: string;
  headers?: Record<string, string>;
  idempotencyKey?: string;
  /** Visible sender name. When set, the from address is `RESEND_FROM_EMAIL`, not `SENDER_NAME`. */
  fromName?: string;
};

export type RecordedEmail = EmailMessage & { id: string };

const STUB_KEY = Symbol.for('hht.emailStub');

type StubGlobal = typeof globalThis & { [STUB_KEY]?: RecordedEmail[] };

/** One inbox for the route-handler bundle and the confirm page bundle. */
function stubInbox(): RecordedEmail[] {
  const g = globalThis as StubGlobal;
  if (!g[STUB_KEY]) g[STUB_KEY] = [];
  return g[STUB_KEY];
}

/** `EMAIL_DELIVERY=stub` is ignored on a production deployment. */
export function isEmailStubEnabled(env: Record<string, string | undefined> = process.env): boolean {
  return env.EMAIL_DELIVERY === 'stub' && env.VERCEL_ENV !== 'production';
}

export function readEmailStub(): readonly RecordedEmail[] {
  return stubInbox();
}

export function resetEmailStub(): void {
  stubInbox().length = 0;
}

export function emailSender(env: Record<string, string | undefined> = process.env): string {
  return (
    env.AUTH_EMAIL_FROM?.trim() ||
    `${SENDER_NAME} <${env.RESEND_FROM_EMAIL?.trim() || 'onboarding@resend.dev'}>`
  );
}

export function subscriberSender(
  fromName: string,
  env: Record<string, string | undefined> = process.env,
): string {
  const address = env.RESEND_FROM_EMAIL?.trim() || 'onboarding@resend.dev';
  return `${fromName} <${address}>`;
}

export class ResendRequestError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly body: string,
  ) {
    super(message);
    this.name = 'ResendRequestError';
  }
}

/** Throws when Resend is not configured or rejects the message. Returns the Resend email id. */
export async function sendEmail(message: EmailMessage): Promise<{ id: string }> {
  if (isEmailStubEnabled()) {
    const inbox = stubInbox();
    const id = `stub_${inbox.length + 1}`;
    inbox.push({ ...message, id });
    return { id };
  }

  const apiKey = process.env.RESEND_API_KEY?.trim();
  if (!apiKey) throw new Error('RESEND_API_KEY is not set');

  const from = message.fromName ? subscriberSender(message.fromName) : emailSender();
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      ...(message.idempotencyKey ? { 'Idempotency-Key': message.idempotencyKey } : {}),
    },
    body: JSON.stringify({
      from,
      to: message.to,
      subject: message.subject,
      text: message.text,
      ...(message.html ? { html: message.html } : {}),
      ...(message.replyTo ? { reply_to: message.replyTo } : {}),
      ...(message.headers ? { headers: message.headers } : {}),
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
  const body = await res.text();
  if (!res.ok) {
    throw new ResendRequestError(
      `Resend rejected the email: ${res.status} ${body}`,
      res.status,
      body,
    );
  }
  try {
    const parsed = JSON.parse(body) as { id?: string };
    return { id: parsed.id ?? '' };
  } catch {
    return { id: '' };
  }
}
