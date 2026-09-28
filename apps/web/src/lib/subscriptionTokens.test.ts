import { createHash } from 'node:crypto';

import { createSubscriptionToken, hashSubscriptionToken } from './subscriptionTokens';

describe('subscription tokens', () => {
  it('is 32 random bytes encoded base64url', () => {
    const { token } = createSubscriptionToken();
    expect(Buffer.from(token, 'base64url')).toHaveLength(32);
    expect(token).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it('stores only the SHA-256 hash, and the token is not the hash', () => {
    const email = 'user@example.com';
    const { token, hash } = createSubscriptionToken();
    expect(hash).toBe(createHash('sha256').update(token).digest('hex'));
    expect(hash).toBe(hashSubscriptionToken(token));
    expect(hash).not.toBe(token);
    expect(token.includes(email)).toBe(false);
    expect(token.includes('@')).toBe(false);
  });

  it('issues a different token each time', () => {
    expect(createSubscriptionToken().token).not.toBe(createSubscriptionToken().token);
  });
});
