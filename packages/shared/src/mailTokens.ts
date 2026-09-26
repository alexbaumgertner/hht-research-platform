import { createHash, randomBytes } from 'node:crypto';

/** 32 random bytes, base64url. Callers store only the SHA-256 hash. */
export function createSubscriptionToken(): { token: string; hash: string } {
  const token = randomBytes(32).toString('base64url');
  return { token, hash: hashSubscriptionToken(token) };
}

export function hashSubscriptionToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

/**
 * Rebuildable link secret. The database stores only the SHA-256 of the token.
 * Rotating the server secret invalidates outstanding links.
 * An empty secret would make every link guessable from a row id, so it throws.
 */
export function derivedSubscriptionToken(
  purpose: string,
  secret: string,
): { token: string; hash: string } {
  if (!secret.trim()) throw new Error('PAYLOAD_SECRET is not set; refusing to derive mail tokens');
  const token = createHash('sha256').update(`${secret}\0${purpose}`).digest('base64url');
  return { token, hash: hashSubscriptionToken(token) };
}

export function unsubscribeTokenFor(subscriberId: string | number, secret: string) {
  return derivedSubscriptionToken(`unsubscribe:${subscriberId}`, secret);
}

export function clickTokenFor(
  digestId: string | number,
  subscriberId: string | number,
  secret: string,
) {
  return derivedSubscriptionToken(`click:${digestId}:${subscriberId}`, secret);
}
