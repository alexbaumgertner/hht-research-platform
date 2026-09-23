import crypto from 'node:crypto';

/**
 * Passwordless admin login: a 6-digit code sent by email.
 *
 * Brute-force protection (ported from sync-trainer):
 * - codes are stored as HMAC hashes, expire in 10 minutes, work once;
 * - 5 wrong attempts burn the code;
 * - at most 3 codes per email per 15 minutes and 20 requests per IP per hour,
 *   counted in the database (serverless instances share no memory);
 * - the response is identical, and takes at least MIN_RESPONSE_MS, whether or
 *   not the address belongs to an admin, so the form cannot enumerate admins.
 */

export const CODE_TTL_MS = 10 * 60 * 1000;
export const MAX_ATTEMPTS = 5;
export const PER_EMAIL_WINDOW_MS = 15 * 60 * 1000;
export const PER_EMAIL_LIMIT = 3;
export const PER_IP_WINDOW_MS = 60 * 60 * 1000;
export const PER_IP_LIMIT = 20;
/** Must outlive the longest rate-limit window, or purging would reset the limiter. */
export const CODE_RETENTION_MS = 24 * 60 * 60 * 1000;
export const MIN_RESPONSE_MS = 400;

export const TOO_MANY = 'Too many attempts. Try again later.';
export const BAD_CODE = 'The code is wrong or has expired.';
export const BAD_EMAIL = 'Enter an email address.';
export const MAIL_BROKEN = 'Could not send the email with your code. Please try again later.';

export type CodeRecord = {
  id: string | number;
  codeHash: string;
  attempts: number;
  delivered: boolean;
};

export interface OtpStore {
  countCodesByEmailSince(email: string, since: Date): Promise<number>;
  countCodesByIpSince(ip: string, since: Date): Promise<number>;
  createCode(record: {
    email: string;
    codeHash: string;
    expiresAt: Date;
    requestIp: string;
    delivered: boolean;
  }): Promise<void>;
  latestActiveCode(email: string, now: Date): Promise<CodeRecord | null>;
  updateCode(id: CodeRecord['id'], patch: { attempts?: number; consumedAt?: Date }): Promise<void>;
  purgeCodesCreatedBefore(cutoff: Date): Promise<void>;
  /** Id of a user allowed into the admin panel with this email, else null. */
  findAdminUserId(email: string): Promise<string | number | null>;
}

export type OtpDeps = {
  store: OtpStore;
  sendCode: (to: string, code: string) => Promise<void>;
  secret: string;
  now?: () => number;
  minResponseMs?: number;
  generateCode?: () => string;
};

export const normalizeEmail = (email: string): string => email.trim().toLowerCase();

export function hashCode(email: string, code: string, secret: string): string {
  return crypto
    .createHmac('sha256', secret)
    .update(`${normalizeEmail(email)}:${code}`)
    .digest('hex');
}

const randomCode = (): string => String(crypto.randomInt(0, 1_000_000)).padStart(6, '0');

async function atLeast<T>(ms: number, work: Promise<T>): Promise<T> {
  const [result] = await Promise.all([work, new Promise((resolve) => setTimeout(resolve, ms))]);
  return result;
}

export type RequestResult = { ok: true } | { ok: false; error: string };

export async function requestCode(
  emailInput: string,
  ip: string,
  deps: OtpDeps,
): Promise<RequestResult> {
  const now = deps.now ?? Date.now;
  return atLeast(
    deps.minResponseMs ?? MIN_RESPONSE_MS,
    (async (): Promise<RequestResult> => {
      const email = normalizeEmail(emailInput);
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { ok: false, error: BAD_EMAIL };

      const t = now();
      await deps.store.purgeCodesCreatedBefore(new Date(t - CODE_RETENTION_MS));

      const [byEmail, byIp] = await Promise.all([
        deps.store.countCodesByEmailSince(email, new Date(t - PER_EMAIL_WINDOW_MS)),
        deps.store.countCodesByIpSince(ip, new Date(t - PER_IP_WINDOW_MS)),
      ]);
      if (byEmail >= PER_EMAIL_LIMIT || byIp >= PER_IP_LIMIT) return { ok: false, error: TOO_MANY };

      const code = (deps.generateCode ?? randomCode)();
      const delivered = (await deps.store.findAdminUserId(email)) !== null;

      // Always stored: the row is also the rate-limit counter for unknown addresses.
      await deps.store.createCode({
        email,
        codeHash: hashCode(email, code, deps.secret),
        expiresAt: new Date(t + CODE_TTL_MS),
        requestIp: ip,
        delivered,
      });

      if (delivered) {
        try {
          await deps.sendCode(email, code);
        } catch (err) {
          // Our failure, not a reason to claim "code sent": the admin would wait forever.
          console.error(
            JSON.stringify({
              severity: 'ERROR',
              message: '[auth] code email failed',
              error: String(err),
            }),
          );
          return { ok: false, error: MAIL_BROKEN };
        }
      }
      return { ok: true };
    })(),
  );
}

export type VerifyResult = { ok: true; userId: string | number } | { ok: false; error: string };

export async function verifyCode(
  emailInput: string,
  codeInput: string,
  deps: OtpDeps,
): Promise<VerifyResult> {
  const now = deps.now ?? Date.now;
  return atLeast(
    deps.minResponseMs ?? MIN_RESPONSE_MS,
    (async (): Promise<VerifyResult> => {
      const email = normalizeEmail(emailInput);
      const code = codeInput.replace(/\s+/g, '');
      if (!/^\d{6}$/.test(code)) return { ok: false, error: BAD_CODE };

      const record = await deps.store.latestActiveCode(email, new Date(now()));
      if (!record) return { ok: false, error: BAD_CODE };

      if (record.attempts >= MAX_ATTEMPTS) {
        await deps.store.updateCode(record.id, { consumedAt: new Date(now()) });
        return { ok: false, error: TOO_MANY };
      }

      const expected = Buffer.from(record.codeHash, 'hex');
      const actual = Buffer.from(hashCode(email, code, deps.secret), 'hex');
      const matches = expected.length === actual.length && crypto.timingSafeEqual(expected, actual);

      if (!matches) {
        const attempts = record.attempts + 1;
        await deps.store.updateCode(record.id, {
          attempts,
          ...(attempts >= MAX_ATTEMPTS ? { consumedAt: new Date(now()) } : {}),
        });
        return { ok: false, error: attempts >= MAX_ATTEMPTS ? TOO_MANY : BAD_CODE };
      }

      await deps.store.updateCode(record.id, { consumedAt: new Date(now()) });
      // No email was sent for non-admin addresses, so their codes can never log in.
      if (!record.delivered) return { ok: false, error: BAD_CODE };

      const userId = await deps.store.findAdminUserId(email);
      return userId === null ? { ok: false, error: BAD_CODE } : { ok: true, userId };
    })(),
  );
}
