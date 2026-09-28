import { createHmac, timingSafeEqual } from 'node:crypto';

const SKEW_MS = 5 * 60 * 1000;

function secretBytes(secret: string): Buffer | null {
  const trimmed = secret.trim();
  if (!trimmed.startsWith('whsec_')) return null;
  try {
    return Buffer.from(trimmed.slice('whsec_'.length), 'base64');
  } catch {
    return null;
  }
}

/** Svix signature used by Resend webhooks. Rejects a stale timestamp or a missing v1 match. */
export function verifySvixSignature(input: {
  secret: string;
  id: string | null;
  timestamp: string | null;
  signature: string | null;
  rawBody: string;
  now?: number;
}): boolean {
  if (!input.id || !input.timestamp || !input.signature) return false;
  const key = secretBytes(input.secret);
  if (!key) return false;
  const ts = Number(input.timestamp);
  if (!Number.isFinite(ts)) return false;
  const now = input.now ?? Date.now();
  if (Math.abs(now - ts * 1000) > SKEW_MS) return false;

  const signed = `${input.id}.${input.timestamp}.${input.rawBody}`;
  const expected = createHmac('sha256', key).update(signed).digest('base64');
  const candidates = input.signature.split(' ').flatMap((part) => {
    const [version, value] = part.split(',', 2);
    return version === 'v1' && value ? [value] : [];
  });
  const expectedBuf = Buffer.from(expected);
  return candidates.some((candidate) => {
    const actual = Buffer.from(candidate);
    if (actual.length !== expectedBuf.length) return false;
    return timingSafeEqual(actual, expectedBuf);
  });
}
