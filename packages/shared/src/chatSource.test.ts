import {
  parseChatSource,
  parseSourceToken,
  partnerSource,
  resolveSubscriptionSource,
} from './chatSource';

describe('parseChatSource', () => {
  it('is unchanged: partner values are not chat sources', () => {
    expect(parseChatSource('vk')).toBe('vk');
    expect(parseChatSource('site:acme')).toBe('other');
    expect(parseChatSource(undefined)).toBe('other');
  });
});

describe('parseSourceToken', () => {
  it.each(['vk', 'wa', 'fb', 'tg', 'site:ab', 'site:curehht-ru', 'site:a1'])('accepts %s', (v) => {
    expect(parseSourceToken(v)).toBe(v);
  });

  it.each([
    undefined,
    null,
    '',
    'other',
    'site:',
    'site:-x',
    'site:a',
    'site:UPPER',
    `site:${'a'.repeat(33)}`,
    'site:a b',
    'xx',
  ])('maps %p to other', (v) => {
    expect(parseSourceToken(v as string | null | undefined)).toBe('other');
  });

  it('accepts a 32-char key', () => {
    expect(parseSourceToken(`site:${'a'.repeat(32)}`)).toBe(`site:${'a'.repeat(32)}`);
  });
});

describe('resolveSubscriptionSource', () => {
  it('passes chat sources through', () => {
    expect(resolveSubscriptionSource('tg', [])).toBe('tg');
  });
  it('accepts a partner only when configured for the project', () => {
    expect(resolveSubscriptionSource('site:acme', ['acme'])).toBe('site:acme');
    expect(resolveSubscriptionSource('site:acme', ['other-one'])).toBe('other');
    expect(resolveSubscriptionSource('site:acme', [])).toBe('other');
  });
  it('maps junk to other', () => {
    expect(resolveSubscriptionSource('site:A', ['A'])).toBe('other');
    expect(resolveSubscriptionSource(undefined, ['acme'])).toBe('other');
  });
});

describe('partnerSource', () => {
  it('prefixes the key', () => {
    expect(partnerSource('acme')).toBe('site:acme');
  });
});
