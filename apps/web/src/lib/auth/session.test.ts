import { issueToken, readSessionCookie, readToken, SESSION_COOKIE } from './session';

const SECRET = 'test-secret';

describe('admin session token', () => {
  const now = Date.UTC(2026, 8, 23, 12);

  it('round-trips a user id', () => {
    const { token } = issueToken(42, SECRET, now);
    expect(readToken(token, SECRET, now + 1000)).toBe('42');
  });

  it('rejects a tampered user id or signature', () => {
    const { token } = issueToken(42, SECRET, now);
    const [, exp, sig] = token.split('.');
    expect(readToken(`1.${exp}.${sig}`, SECRET, now)).toBeNull();
    expect(readToken(`42.${exp}.${sig}x`, SECRET, now)).toBeNull();
  });

  it('rejects tokens signed with another secret', () => {
    const { token } = issueToken(42, 'other-secret', now);
    expect(readToken(token, SECRET, now)).toBeNull();
  });

  it('expires', () => {
    const { token, maxAge } = issueToken(42, SECRET, now);
    expect(readToken(token, SECRET, now + maxAge * 1000 + 1000)).toBeNull();
  });

  it('refuses to work without a secret', () => {
    expect(() => issueToken(42, '', now)).toThrow();
    expect(readToken('42.1.x', '', now)).toBeNull();
  });

  it('reads the cookie from a header', () => {
    expect(readSessionCookie(`a=1; ${SESSION_COOKIE}=abc.def; b=2`)).toBe('abc.def');
    expect(readSessionCookie('a=1')).toBeUndefined();
    expect(readSessionCookie(null)).toBeUndefined();
  });
});
