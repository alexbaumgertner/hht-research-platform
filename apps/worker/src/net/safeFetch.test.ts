import { assertAllowedUrl, guardedLookup, isBlockedAddress } from './safeFetch.js';

describe('isBlockedAddress', () => {
  it('blocks loopback and private IPv4', () => {
    expect(isBlockedAddress('127.0.0.1')).toBe(true);
    expect(isBlockedAddress('10.0.0.1')).toBe(true);
    expect(isBlockedAddress('172.16.5.1')).toBe(true);
    expect(isBlockedAddress('192.168.1.1')).toBe(true);
  });

  it('blocks cloud metadata link-local', () => {
    expect(isBlockedAddress('169.254.169.254')).toBe(true);
  });

  it('blocks CGNAT and multicast', () => {
    expect(isBlockedAddress('100.64.0.1')).toBe(true);
    expect(isBlockedAddress('224.0.0.1')).toBe(true);
  });

  it('blocks IPv6 loopback and ULA', () => {
    expect(isBlockedAddress('::1')).toBe(true);
    expect(isBlockedAddress('fd12::1')).toBe(true);
    expect(isBlockedAddress('fe80::1')).toBe(true);
  });

  it('blocks IPv4-mapped IPv6 private', () => {
    expect(isBlockedAddress('::ffff:127.0.0.1')).toBe(true);
    expect(isBlockedAddress('::ffff:10.0.0.1')).toBe(true);
  });

  it('allows public addresses', () => {
    expect(isBlockedAddress('8.8.8.8')).toBe(false);
    expect(isBlockedAddress('1.1.1.1')).toBe(false);
  });
});

describe('assertAllowedUrl', () => {
  const originalAllow = process.env.ALLOW_PRIVATE_NETWORK_FETCH;
  const originalAllowlist = process.env.RSS_HOST_ALLOWLIST;

  beforeEach(() => {
    delete process.env.ALLOW_PRIVATE_NETWORK_FETCH;
    delete process.env.RSS_HOST_ALLOWLIST;
  });

  afterEach(() => {
    if (originalAllow === undefined) delete process.env.ALLOW_PRIVATE_NETWORK_FETCH;
    else process.env.ALLOW_PRIVATE_NETWORK_FETCH = originalAllow;
    if (originalAllowlist === undefined) delete process.env.RSS_HOST_ALLOWLIST;
    else process.env.RSS_HOST_ALLOWLIST = originalAllowlist;
  });

  it('accepts https public URLs', () => {
    expect(assertAllowedUrl('https://example.com/feed.xml').hostname).toBe('example.com');
  });

  it('rejects non-http schemes', () => {
    expect(() => assertAllowedUrl('ftp://example.com')).toThrow(/protocol/i);
    expect(() => assertAllowedUrl('javascript:alert(1)')).toThrow();
  });

  it('rejects non-standard ports', () => {
    expect(() => assertAllowedUrl('https://example.com:8443/feed')).toThrow(/port/i);
  });

  it('rejects localhost unless ALLOW_PRIVATE_NETWORK_FETCH=1', () => {
    expect(() => assertAllowedUrl('http://localhost/feed')).toThrow(/hostname/i);
    process.env.ALLOW_PRIVATE_NETWORK_FETCH = '1';
    expect(assertAllowedUrl('http://localhost/feed').hostname).toBe('localhost');
  });

  it('rejects literal private IPs', () => {
    expect(() => assertAllowedUrl('http://169.254.169.254/latest')).toThrow(/address/i);
  });

  it('honours RSS_HOST_ALLOWLIST when set', () => {
    process.env.RSS_HOST_ALLOWLIST = 'feeds.example.com,other.org';
    expect(assertAllowedUrl('https://feeds.example.com/rss').hostname).toBe('feeds.example.com');
    expect(() => assertAllowedUrl('https://evil.com/rss')).toThrow(/allowlist/i);
  });
});

describe('guardedLookup', () => {
  // undici's connector always calls lookup with { all: true }; the callback must
  // then receive an array, not (address, family). Regression guard — a broken
  // shape here fails every outbound fetch in the worker while unit tests of the
  // pure helpers still pass.
  const origAllow = process.env.ALLOW_PRIVATE_NETWORK_FETCH;
  afterEach(() => {
    if (origAllow === undefined) delete process.env.ALLOW_PRIVATE_NETWORK_FETCH;
    else process.env.ALLOW_PRIVATE_NETWORK_FETCH = origAllow;
  });

  it('returns a LookupEntry[] for { all: true } and blocks private results', (done) => {
    // localhost resolves offline (hosts file) to a loopback address.
    guardedLookup('localhost', { all: true }, (err: NodeJS.ErrnoException | null) => {
      expect(err).toBeInstanceOf(Error);
      expect(err?.message).toMatch(/blocked resolved address/i);
      done();
    });
  });

  it('passes the array through unchanged when private fetch is allowed', (done) => {
    process.env.ALLOW_PRIVATE_NETWORK_FETCH = '1';
    guardedLookup('localhost', { all: true }, (err: NodeJS.ErrnoException | null, res: unknown) => {
      expect(err).toBeNull();
      expect(Array.isArray(res)).toBe(true);
      expect((res as Array<{ address: string }>).length).toBeGreaterThan(0);
      expect(typeof (res as Array<{ address: string }>)[0]!.address).toBe('string');
      done();
    });
  });

  it('supports the single-address callback form', (done) => {
    process.env.ALLOW_PRIVATE_NETWORK_FETCH = '1';
    guardedLookup(
      'localhost',
      {},
      (err: NodeJS.ErrnoException | null, address: unknown, family: unknown) => {
        expect(err).toBeNull();
        expect(typeof address).toBe('string');
        expect(typeof family).toBe('number');
        done();
      },
    );
  });
});
