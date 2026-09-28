import { clickTokenFor, hashSubscriptionToken, unsubscribeTokenFor } from './mailTokens.js';

describe('derived mail tokens', () => {
  it('is stable for the same secret and differs across secrets', () => {
    const a = unsubscribeTokenFor(7, 'secret-a');
    expect(unsubscribeTokenFor(7, 'secret-a')).toEqual(a);
    expect(unsubscribeTokenFor(7, 'secret-b').token).not.toBe(a.token);
    expect(a.hash).toBe(hashSubscriptionToken(a.token));
  });

  it('refuses an empty or blank secret', () => {
    expect(() => unsubscribeTokenFor(7, '')).toThrow('PAYLOAD_SECRET');
    expect(() => clickTokenFor(1, 7, '   ')).toThrow('PAYLOAD_SECRET');
  });
});
