import { shouldUseCachedTranslation } from './translations';

describe('shouldUseCachedTranslation', () => {
  it('returns false for missing cache', () => {
    expect(shouldUseCachedTranslation(null)).toBe(false);
    expect(shouldUseCachedTranslation(undefined)).toBe(false);
  });

  it('returns true when all summary fields are present', () => {
    expect(
      shouldUseCachedTranslation({
        objective: 'o',
        methods: 'm',
        results: 'r',
        limitations: 'l',
        whyItMatters: 'w',
      }),
    ).toBe(true);
  });

  it('returns false when any field is empty', () => {
    expect(
      shouldUseCachedTranslation({
        objective: 'o',
        methods: '',
        results: 'r',
        limitations: 'l',
        whyItMatters: 'w',
      }),
    ).toBe(false);
  });
});
