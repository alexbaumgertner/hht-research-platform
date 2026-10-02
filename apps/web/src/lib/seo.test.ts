import { PUBLIC_LOCALES } from '@hht/shared';

import { buildRobots, buildSitemap, localeAlternates } from './seo';

const SITE = 'https://hht.rarediseasedigest.org';

const PROJECTS = [
  {
    slug: 'hht-research',
    issues: [
      { id: '7', updatedAt: '2026-09-28T10:00:00.000Z' },
      { id: '6', updatedAt: '2026-09-21T10:00:00.000Z' },
    ],
    materials: [{ id: '41', updatedAt: '2026-09-30T08:00:00.000Z' }],
  },
];

function hostsIn(value: unknown): string[] {
  return [...JSON.stringify(value).matchAll(/https?:\/\/[^/"]+/g)].map((match) => match[0]);
}

describe('localeAlternates', () => {
  it('lists every public locale plus x-default on the default locale', () => {
    const languages = localeAlternates('/projects/hht-research', SITE);
    expect(Object.keys(languages)).toEqual([...PUBLIC_LOCALES, 'x-default']);
    expect(languages['x-default']).toBe(`${SITE}/en/projects/hht-research`);
    expect(languages.ru).toBe(`${SITE}/ru/projects/hht-research`);
  });

  it('stays relative without a site so metadataBase resolves it', () => {
    expect(localeAlternates('')['x-default']).toBe('/en');
  });
});

describe('buildSitemap', () => {
  const sitemap = buildSitemap(`${SITE}/`, PROJECTS);

  it('uses only PUBLIC_SITE_URL as host, including alternates', () => {
    const hosts = new Set(hostsIn(sitemap));
    expect([...hosts]).toEqual([SITE]);
  });

  it('includes home, project, archive, every issue and material in every locale', () => {
    const urls = sitemap.map((entry) => entry.url);
    for (const locale of PUBLIC_LOCALES) {
      expect(urls).toEqual(
        expect.arrayContaining([
          `${SITE}/${locale}`,
          `${SITE}/${locale}/projects/hht-research`,
          `${SITE}/${locale}/projects/hht-research/issues`,
          `${SITE}/${locale}/projects/hht-research/issues/7`,
          `${SITE}/${locale}/projects/hht-research/issues/6`,
          `${SITE}/${locale}/projects/hht-research/publications/41`,
        ]),
      );
    }
    expect(urls).toHaveLength(6 * PUBLIC_LOCALES.length);
  });

  it('dates pages from the content they show', () => {
    const at = (url: string) =>
      sitemap.find((entry) => entry.url === url)?.lastModified as Date | undefined;
    expect(at(`${SITE}/ru/projects/hht-research/issues/6`)?.toISOString()).toBe(
      '2026-09-21T10:00:00.000Z',
    );
    expect(at(`${SITE}/en/projects/hht-research/issues`)?.toISOString()).toBe(
      '2026-09-28T10:00:00.000Z',
    );
    expect(at(`${SITE}/en/projects/hht-research`)?.toISOString()).toBe('2026-09-30T08:00:00.000Z');
    expect(at(`${SITE}/en`)?.toISOString()).toBe('2026-09-30T08:00:00.000Z');
  });
});

describe('buildRobots', () => {
  it('allows indexing on production and points at the sitemap on PUBLIC_SITE_URL', () => {
    const robots = buildRobots(SITE, { VERCEL_ENV: 'production' });
    expect(robots.sitemap).toBe(`${SITE}/sitemap.xml`);
    expect(new Set(hostsIn(robots))).toEqual(new Set([SITE]));
  });

  it.each([['preview'], ['development'], [undefined]])('disallows everything on %s', (env) => {
    const robots = buildRobots(SITE, { VERCEL_ENV: env });
    expect(robots.rules).toEqual({ userAgent: '*', disallow: '/' });
    expect(robots.sitemap).toBeUndefined();
  });
});
