import { filterByImportance, hasNonEmptyKeywords, isValidHttpUrl } from './index';

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
});

describe('isValidHttpUrl', () => {
  it('accepts http(s) URLs only', () => {
    expect(isValidHttpUrl('https://example.com/feed.xml')).toBe(true);
    expect(isValidHttpUrl('ftp://example.com')).toBe(false);
    expect(isValidHttpUrl('not-a-url')).toBe(false);
  });
});
