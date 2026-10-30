import {
  EMBED_NOTICES,
  formatEmbedOptions,
  normalizeEmbedOrigin,
  noticeToSegment,
  parseEmbedOptions,
  PartnerKeySchema,
  segmentToNotice,
} from './embed';

describe('PartnerKeySchema', () => {
  it.each(['ab', 'curehht-ru', 'a1'])('accepts %s', (v) => {
    expect(PartnerKeySchema.safeParse(v).success).toBe(true);
  });
  it.each(['a', '-ab', 'AB', 'a b', 'a'.repeat(33)])('rejects %s', (v) => {
    expect(PartnerKeySchema.safeParse(v).success).toBe(false);
  });
});

describe('normalizeEmbedOrigin', () => {
  it('lowercases and keeps scheme://host[:port]', () => {
    expect(normalizeEmbedOrigin('HTTPS://Curehht-RU.org')).toBe('https://curehht-ru.org');
    expect(normalizeEmbedOrigin('https://example.org:8443')).toBe('https://example.org:8443');
  });
  it('drops a default port', () => {
    expect(normalizeEmbedOrigin('https://example.org:443')).toBe('https://example.org');
  });
  it('allows http only for localhost, 127.0.0.1 and *.test', () => {
    expect(normalizeEmbedOrigin('http://localhost:3000')).toBe('http://localhost:3000');
    expect(normalizeEmbedOrigin('http://127.0.0.1:4310')).toBe('http://127.0.0.1:4310');
    expect(normalizeEmbedOrigin('http://partner.test')).toBe('http://partner.test');
    expect(normalizeEmbedOrigin('http://example.org')).toBeNull();
  });
  it.each([
    'https://example.org/path',
    'https://example.org/?q=1',
    'https://example.org/#x',
    'https://*.example.org',
    '*',
    'https://user:pw@example.org',
    'ftp://example.org',
    'example.org',
    '',
  ])('rejects %s', (v) => {
    expect(normalizeEmbedOrigin(v)).toBeNull();
  });
});

describe('embed options', () => {
  it('parses valid options', () => {
    expect(parseEmbedOptions('dark-5-link')).toEqual({
      options: { theme: 'dark', items: 5, mode: 'link' },
      canonical: 'dark-5-link',
      changed: false,
    });
  });
  it('falls back per part and flags the change', () => {
    const r = parseEmbedOptions('de-99-x');
    expect(r.options).toEqual({ theme: 'auto', items: 3, mode: 'form' });
    expect(r.canonical).toBe('auto-3-form');
    expect(r.changed).toBe(true);
  });
  it('rejects items out of 1..20', () => {
    expect(parseEmbedOptions('auto-0-form').changed).toBe(true);
    expect(parseEmbedOptions('auto-20-form').changed).toBe(false);
    expect(parseEmbedOptions('auto-21-form').changed).toBe(true);
  });
  it('round-trips', () => {
    const o = { theme: 'light', items: 12, mode: 'link' } as const;
    expect(parseEmbedOptions(formatEmbedOptions(o)).options).toEqual(o);
  });
});

describe('notices', () => {
  it('maps both ways', () => {
    expect(EMBED_NOTICES).toEqual(['check_inbox', 'need_consent', 'bad_email', 'try_later']);
    expect(noticeToSegment('check_inbox')).toBe('check-inbox');
    expect(segmentToNotice('need-consent')).toBe('need_consent');
    expect(segmentToNotice('bad-email')).toBe('bad_email');
    expect(segmentToNotice('try-later')).toBe('try_later');
    expect(segmentToNotice('nope')).toBeNull();
  });
});
