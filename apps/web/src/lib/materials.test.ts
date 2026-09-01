import type { Summary } from '@hht/shared';

import {
  collapseImportance,
  filterMaterials,
  pickNonEmptySections,
  placeholderTitle,
  resolveEmptyState,
  resolveLocalizedContent,
  resolveLocalizedDetail,
  resolveSource,
  toMaterial,
  toMaterialDetail,
} from './materials';

const fullSummary: Summary = {
  objective: 'Obj',
  methods: 'Meth',
  results: 'Res',
  limitations: 'Lim',
  whyItMatters: 'Why',
};

describe('resolveSource (R3)', () => {
  it('maps pubmed and clinicaltrials', () => {
    expect(resolveSource('pubmed')).toBe('pubmed');
    expect(resolveSource('clinicaltrials')).toBe('trials');
  });

  it('maps rss with category, defaulting unset to news', () => {
    expect(resolveSource('rss', 'guideline')).toBe('guideline');
    expect(resolveSource('rss', 'social')).toBe('social');
    expect(resolveSource('rss', 'news')).toBe('news');
    expect(resolveSource('rss', null)).toBe('news');
    expect(resolveSource('rss')).toBe('news');
  });

  it('falls back for unrecognised sourceType', () => {
    expect(resolveSource('blog')).toBe('unknown');
    expect(resolveSource(null)).toBe('unknown');
    expect(resolveSource(undefined)).toBe('unknown');
  });
});

describe('collapseImportance', () => {
  it('maps critical/high → high', () => {
    expect(collapseImportance('critical')).toBe('high');
    expect(collapseImportance('high')).toBe('high');
  });

  it('maps medium/low/null → normal', () => {
    expect(collapseImportance('medium')).toBe('normal');
    expect(collapseImportance('low')).toBe('normal');
    expect(collapseImportance(null)).toBe('normal');
    expect(collapseImportance(undefined)).toBe('normal');
  });
});

describe('resolveLocalizedContent', () => {
  it('uses English directly for en', () => {
    const result = resolveLocalizedContent({
      locale: 'en',
      englishTitle: 'English title',
      englishSummary: fullSummary,
    });
    expect(result).toEqual({
      title: 'English title',
      summary: 'Obj',
      displayedLocale: 'en',
      isFallback: false,
    });
  });

  it('uses translation on full hit', () => {
    const result = resolveLocalizedContent({
      locale: 'de',
      englishTitle: 'English title',
      englishSummary: fullSummary,
      translation: {
        title: 'Deutscher Titel',
        fields: {
          ...fullSummary,
          objective: 'Ziel',
        },
      },
    });
    expect(result).toEqual({
      title: 'Deutscher Titel',
      summary: 'Ziel',
      displayedLocale: 'de',
      isFallback: false,
    });
  });

  it('falls back on miss', () => {
    const result = resolveLocalizedContent({
      locale: 'de',
      englishTitle: 'English title',
      englishSummary: fullSummary,
      translation: null,
    });
    expect(result.isFallback).toBe(true);
    expect(result.displayedLocale).toBe('en');
    expect(result.title).toBe('English title');
  });

  it('falls back on partial miss (title without complete summary)', () => {
    const result = resolveLocalizedContent({
      locale: 'de',
      englishTitle: 'English title',
      englishSummary: fullSummary,
      translation: {
        title: 'Deutscher Titel',
        fields: { objective: 'Ziel' },
      },
    });
    expect(result.isFallback).toBe(true);
    expect(result.displayedLocale).toBe('en');
    expect(result.title).toBe('English title');
  });
});

describe('placeholderTitle', () => {
  it('builds source + date placeholder', () => {
    expect(placeholderTitle('pubmed', '2026-01-15T10:00:00.000Z')).toBe('pubmed · 2026-01-15');
    expect(placeholderTitle('news', null)).toBe('news · undated');
  });
});

describe('toMaterial', () => {
  it('maps a publication and uses placeholder for empty title', () => {
    const material = toMaterial(
      {
        id: 42,
        title: '  ',
        sourceType: 'pubmed',
        importance: 'critical',
        publishedOrUpdatedAt: '2026-03-01T00:00:00.000Z',
        originalUrl: 'https://example.com/p',
        summary: fullSummary,
      },
      'en',
    );
    expect(material.title).toBe('pubmed · 2026-03-01');
    expect(material.source).toBe('pubmed');
    expect(material.importance).toBe('high');
    expect(material.url).toBe('https://example.com/p');
    expect(material.isFallback).toBe(false);
  });

  it('resolves rss + guideline category via monitoredSource', () => {
    const material = toMaterial(
      {
        id: '1',
        title: 'Guideline doc',
        sourceType: 'rss',
        monitoredSource: { id: 9, displayCategory: 'guideline' },
        originalUrl: 'https://example.com/g',
      },
      'en',
    );
    expect(material.source).toBe('guideline');
  });

  it('sets isFallback and displayedLocale for untranslated locale', () => {
    const material = toMaterial(
      {
        id: '1',
        title: 'English only',
        sourceType: 'pubmed',
        originalUrl: 'https://example.com/e',
        summary: fullSummary,
      },
      'de',
      null,
    );
    expect(material.isFallback).toBe(true);
    expect(material.displayedLocale).toBe('en');
    expect(material.title).toBe('English only');
  });
});

describe('filterMaterials', () => {
  const items = [
    toMaterial(
      {
        id: '1',
        title: 'Bevacizumab epistaxis',
        sourceType: 'pubmed',
        importance: 'high',
        originalUrl: 'https://example.com/1',
        summary: { ...fullSummary, objective: 'Evaluate bevacizumab' },
      },
      'en',
    ),
    toMaterial(
      {
        id: '2',
        title: 'Social post about HHT',
        sourceType: 'rss',
        monitoredSource: { displayCategory: 'social' },
        importance: 'low',
        originalUrl: 'https://example.com/2',
        summary: { ...fullSummary, objective: 'Community update' },
      },
      'en',
    ),
  ];

  it('empty sources means all', () => {
    expect(filterMaterials(items, { q: '', sources: [], important: false })).toHaveLength(2);
  });

  it('filters by source chips', () => {
    expect(filterMaterials(items, { q: '', sources: ['pubmed'], important: false })).toHaveLength(
      1,
    );
  });

  it('filters by high importance', () => {
    expect(filterMaterials(items, { q: '', sources: [], important: true })).toHaveLength(1);
  });

  it('case-insensitive search on displayed title/summary', () => {
    expect(
      filterMaterials(items, { q: 'BEVACIZUMAB', sources: [], important: false }),
    ).toHaveLength(1);
    expect(filterMaterials(items, { q: 'community', sources: [], important: false })).toHaveLength(
      1,
    );
  });

  it('combines search ∧ sources ∧ importance', () => {
    expect(
      filterMaterials(items, { q: 'bevacizumab', sources: ['pubmed'], important: true }),
    ).toHaveLength(1);
    expect(
      filterMaterials(items, { q: 'bevacizumab', sources: ['social'], important: true }),
    ).toHaveLength(0);
  });

  it('matches displayed (translated) title, not English-only storage', () => {
    const translated = toMaterial(
      {
        id: '3',
        title: 'English title only',
        sourceType: 'pubmed',
        originalUrl: 'https://example.com/3',
        summary: fullSummary,
      },
      'de',
      {
        title: 'Deutscher Titel über Epistaxis',
        fields: { ...fullSummary, objective: 'Zieltext' },
      },
    );
    expect(translated.title).toContain('Deutscher');
    expect(
      filterMaterials([translated], { q: 'epistaxis', sources: [], important: false }),
    ).toHaveLength(1);
    expect(
      filterMaterials([translated], { q: 'english title', sources: [], important: false }),
    ).toHaveLength(0);
  });
});

describe('resolveEmptyState', () => {
  it('distinguishes empty project from no matches', () => {
    expect(resolveEmptyState(0, 0)).toBe('empty-project');
    expect(resolveEmptyState(5, 0)).toBe('no-matches');
    expect(resolveEmptyState(5, 2)).toBeNull();
  });
});

describe('pickNonEmptySections', () => {
  it('omits blank keys', () => {
    expect(pickNonEmptySections({ objective: 'Obj', methods: '  ', results: '' })).toEqual({
      objective: 'Obj',
    });
    expect(pickNonEmptySections(null)).toEqual({});
  });
});

describe('resolveLocalizedDetail', () => {
  it('returns full English sections for en', () => {
    const result = resolveLocalizedDetail({
      locale: 'en',
      englishTitle: 'English title',
      englishSummary: fullSummary,
    });
    expect(result.isFallback).toBe(false);
    expect(result.summary.objective).toBe('Obj');
    expect(result.summary.whyItMatters).toBe('Why');
  });

  it('falls back on miss with English sections', () => {
    const result = resolveLocalizedDetail({
      locale: 'de',
      englishTitle: 'English title',
      englishSummary: fullSummary,
      translation: null,
    });
    expect(result.isFallback).toBe(true);
    expect(result.displayedLocale).toBe('en');
    expect(result.summary.objective).toBe('Obj');
  });
});

describe('toMaterialDetail', () => {
  it('omits empty summary sections and null abstract', () => {
    const detail = toMaterialDetail(
      {
        id: '1',
        title: 'Paper',
        sourceType: 'pubmed',
        importance: 'critical',
        publishedOrUpdatedAt: '2026-03-01T00:00:00.000Z',
        originalUrl: 'https://example.com/p',
        summary: { objective: 'Only objective', methods: '  ' },
        abstractOrBody: '  ',
      },
      'en',
    );
    expect(detail.importance).toBe('high');
    expect(detail.summary).toEqual({ objective: 'Only objective' });
    expect(detail.abstractOrBody).toBeNull();
    expect(detail.abstractIsFallback).toBe(false);
    expect(detail.originalUrl).toBe('https://example.com/p');
  });

  it('uses placeholder title when empty', () => {
    const detail = toMaterialDetail(
      {
        id: 7,
        title: ' ',
        sourceType: 'pubmed',
        publishedOrUpdatedAt: '2026-01-02T00:00:00.000Z',
      },
      'en',
    );
    expect(detail.title).toBe('pubmed · 2026-01-02');
  });

  it('sets abstractIsFallback when locale is not English and abstract exists', () => {
    const detail = toMaterialDetail(
      {
        id: '1',
        title: 'English only',
        sourceType: 'pubmed',
        summary: fullSummary,
        abstractOrBody: 'Stored abstract in English.',
      },
      'de',
      null,
    );
    expect(detail.isFallback).toBe(true);
    expect(detail.abstractOrBody).toBe('Stored abstract in English.');
    expect(detail.abstractIsFallback).toBe(true);
    expect(detail.displayedLocale).toBe('en');
  });

  it('does not mark abstract fallback for English locale', () => {
    const detail = toMaterialDetail(
      {
        id: '1',
        title: 'Paper',
        sourceType: 'pubmed',
        abstractOrBody: 'Abstract text',
      },
      'en',
    );
    expect(detail.abstractIsFallback).toBe(false);
  });
});
