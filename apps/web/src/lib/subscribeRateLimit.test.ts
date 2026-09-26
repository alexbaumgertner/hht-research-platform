import { createHash } from 'node:crypto';

import { hashSubscribeRateKey, rateLimitDecision } from './subscribeRateLimit';

describe('subscribe rate limit', () => {
  it('rejects more than 5 submissions in the window', () => {
    expect(rateLimitDecision(4)).toBe('ok');
    expect(rateLimitDecision(5)).toBe('limited');
    expect(rateLimitDecision(6)).toBe('limited');
  });

  it('stores the SHA-256 of the secret plus the IP, not the raw IP', () => {
    const secret = 'payload-secret';
    const ip = '203.0.113.8';
    const key = hashSubscribeRateKey(secret, ip);
    expect(key).toBe(createHash('sha256').update(`${secret}${ip}`).digest('hex'));
    expect(key.includes(ip)).toBe(false);
    expect(key).toHaveLength(64);
  });
});
