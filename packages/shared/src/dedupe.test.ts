import { dedupeKey, normalizeTitle } from './dedupe';

describe('normalizeTitle', () => {
  it('lowercases and strips punctuation', () => {
    expect(normalizeTitle('  Hello, World! ')).toBe('hello world');
  });
});

describe('dedupeKey', () => {
  it('prefers DOI', () => {
    expect(dedupeKey({ doi: 'https://doi.org/10.1000/XYZ', pmid: '1' }, 'Title', 'pubmed')).toBe(
      'doi:10.1000/xyz',
    );
  });

  it('uses PMID when no DOI', () => {
    expect(dedupeKey({ pmid: '12345' }, 'Title', 'pubmed')).toBe('pmid:12345');
  });

  it('uses NCT when no DOI/PMID', () => {
    expect(dedupeKey({ nctId: 'nct0123' }, 'Title', 'clinicaltrials')).toBe('nct:NCT0123');
  });

  it('uses GUID for RSS', () => {
    expect(dedupeKey({ guid: 'abc' }, 'Title', 'rss')).toBe('guid:abc');
  });

  it('falls back to normalized title + sourceType', () => {
    expect(dedupeKey({}, 'Hello World', 'rss')).toBe('title:rss:hello world');
  });
});
