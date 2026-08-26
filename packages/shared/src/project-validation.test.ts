import { hasNonEmptyKeywords, isValidHttpUrl } from './index';

describe('project validation helpers', () => {
  it('rejects empty keywords for activation', () => {
    expect(hasNonEmptyKeywords([])).toBe(false);
    expect(hasNonEmptyKeywords(['topic'])).toBe(true);
    expect(hasNonEmptyKeywords([{ value: 'topic' }])).toBe(true);
    expect(hasNonEmptyKeywords([{ value: '   ' }])).toBe(false);
  });

  it('rejects non-URL RSS values', () => {
    expect(isValidHttpUrl('notaurl')).toBe(false);
    expect(isValidHttpUrl('https://feeds.example.com/rss')).toBe(true);
  });
});
