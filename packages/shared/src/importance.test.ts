import { filterByImportance, hasNonEmptyKeywords, isValidHttpUrl, sanitizeHttpUrl } from './index';

describe('filterByImportance', () => {
  const items = [
    { id: 1, importance: 'high' as const },
    { id: 2, importance: 'low' as const },
    { id: 3, importance: 'high' as const },
  ];

  it('returns all when filter unset', () => {
    expect(filterByImportance(items, undefined)).toHaveLength(3);
  });

  it('filters to matching importance', () => {
    expect(filterByImportance(items, 'high').map((i: { id: number }) => i.id)).toEqual([1, 3]);
  });
});

describe('hasNonEmptyKeywords', () => {
  it('requires at least one non-empty keyword', () => {
    expect(hasNonEmptyKeywords([])).toBe(false);
    expect(hasNonEmptyKeywords(['', '  '])).toBe(false);
    expect(hasNonEmptyKeywords(['HHT'])).toBe(true);
  });

  it('accepts Payload array rows shaped as { value }', () => {
    expect(hasNonEmptyKeywords([{ value: '' }, { value: '  ' }])).toBe(false);
    expect(hasNonEmptyKeywords([{ value: 'HHT' }])).toBe(true);
    expect(hasNonEmptyKeywords([{ value: 'HHT' }, 'telangiectasia'])).toBe(true);
  });
});

describe('isValidHttpUrl', () => {
  it('accepts http(s) URLs only', () => {
    expect(isValidHttpUrl('https://example.com/feed.xml')).toBe(true);
    expect(isValidHttpUrl('ftp://example.com')).toBe(false);
    expect(isValidHttpUrl('not-a-url')).toBe(false);
  });
});

describe('sanitizeHttpUrl', () => {
  it('returns normalized http(s) href', () => {
    expect(sanitizeHttpUrl('https://example.com/path')).toBe('https://example.com/path');
  });

  it('rejects javascript: and data: URIs', () => {
    expect(sanitizeHttpUrl('javascript:alert(1)')).toBeNull();
    expect(sanitizeHttpUrl('data:text/html,<script>')).toBeNull();
  });

  it('rejects empty and relative values', () => {
    expect(sanitizeHttpUrl('')).toBeNull();
    expect(sanitizeHttpUrl(null)).toBeNull();
    expect(sanitizeHttpUrl('/relative')).toBeNull();
  });
});
