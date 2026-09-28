import { createHash } from 'node:crypto';

const HOUR_MS = 60 * 60 * 1000;

/** SHA-256 of the server secret plus the client IP. The raw IP is not stored. */
export function hashSubscribeRateKey(secret: string, ip: string): string {
  return createHash('sha256').update(`${secret}${ip}`).digest('hex');
}

/** More than 5 submissions of this key in the last hour are rejected. */
export function rateLimitDecision(recentCount: number): 'ok' | 'limited' {
  return recentCount >= 5 ? 'limited' : 'ok';
}

export const SUBSCRIBE_RATE_WINDOW_MS = HOUR_MS;

export async function consumeSubscribeRateLimit(
  ip: string,
  now = new Date(),
): Promise<'ok' | 'limited'> {
  const { getPayload } = await import('payload');
  const { default: config } = await import('@payload-config');
  const secret = process.env.PAYLOAD_SECRET ?? '';
  const keyHash = hashSubscribeRateKey(secret, ip);
  const since = new Date(now.getTime() - SUBSCRIBE_RATE_WINDOW_MS).toISOString();
  const payload = await getPayload({ config });
  const existing = await payload.find({
    collection: 'subscribe-rate-limits',
    where: {
      and: [{ keyHash: { equals: keyHash } }, { createdAt: { greater_than: since } }],
    },
    limit: 6,
    depth: 0,
    overrideAccess: true,
  });
  if (rateLimitDecision(existing.docs.length) === 'limited') return 'limited';
  await payload.create({
    collection: 'subscribe-rate-limits',
    data: { keyHash },
    overrideAccess: true,
  });
  return 'ok';
}
