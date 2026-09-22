import { missingTranslations } from './backfill.js';

describe('missingTranslations', () => {
  const complete = {
    objective: 'o',
    methods: 'm',
    results: 'r',
    limitations: 'l',
    whyItMatters: 'w',
  };

  it('lists every (publication, locale) pair without a translation', () => {
    const pubs = [
      { id: 1, title: 'A', summary: complete },
      { id: 2, title: 'B', summary: complete },
    ];
    const existing = [
      { publication: 1, locale: 'ru' },
      { publication: 2, locale: 'de' },
    ];
    expect(missingTranslations(pubs, existing, ['ru', 'de'])).toEqual([
      { publication: pubs[0], locale: 'de' },
      { publication: pubs[1], locale: 'ru' },
    ]);
  });

  it('skips publications without a complete English summary', () => {
    const pubs = [{ id: 3, title: 'C', summary: { ...complete, results: '' } }];
    expect(missingTranslations(pubs, [], ['ru'])).toEqual([]);
  });

  it('matches ids regardless of string/number shape', () => {
    const pubs = [{ id: 4, title: 'D', summary: complete }];
    expect(missingTranslations(pubs, [{ publication: '4', locale: 'ru' }], ['ru'])).toEqual([]);
  });
});
