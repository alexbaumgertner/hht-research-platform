import type { MetadataRoute } from 'next';

import { PUBLIC_LOCALES } from '@hht/shared';

const DEFAULT_LOCALE = 'en';

/**
 * `hreflang` targets for a path without the locale prefix. `x-default` is the default locale.
 * Pass `site` for absolute URLs (sitemap); pages leave it out and resolve via `metadataBase`.
 */
export function localeAlternates(path: string, site = ''): Record<string, string> {
  return {
    ...Object.fromEntries(PUBLIC_LOCALES.map((locale) => [locale, `${site}/${locale}${path}`])),
    'x-default': `${site}/${DEFAULT_LOCALE}${path}`,
  };
}

export type SitemapProject = {
  slug: string;
  issues: Array<{ id: string; updatedAt: string | null }>;
  materials: Array<{ id: string; updatedAt: string | null }>;
};

function lastModified(value: string | null): Date | undefined {
  if (!value) return undefined;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

/** One entry per page and locale, each listing every locale as an alternate. */
export function buildSitemap(siteUrl: string, projects: SitemapProject[]): MetadataRoute.Sitemap {
  const site = siteUrl.replace(/\/$/, '');
  // Project rows change on every monitoring run, so pages date from the content they show.
  const pages: Array<{ path: string; updatedAt: string | null }> = [{ path: '', updatedAt: null }];
  for (const project of projects) {
    const base = `/projects/${project.slug}`;
    const newestIssue = latest(project.issues.map((issue) => issue.updatedAt));
    const newestMaterial = latest(project.materials.map((material) => material.updatedAt));
    pages.push({ path: base, updatedAt: latest([newestIssue, newestMaterial]) });
    pages.push({ path: `${base}/issues`, updatedAt: newestIssue });
    for (const issue of project.issues) {
      pages.push({ path: `${base}/issues/${issue.id}`, updatedAt: issue.updatedAt });
    }
    for (const material of project.materials) {
      pages.push({ path: `${base}/publications/${material.id}`, updatedAt: material.updatedAt });
    }
  }

  pages[0].updatedAt = latest(pages.map((page) => page.updatedAt));

  return pages.flatMap((page) => {
    const languages = localeAlternates(page.path, site);
    return PUBLIC_LOCALES.map((locale) => ({
      url: `${site}/${locale}${page.path}`,
      lastModified: lastModified(page.updatedAt),
      alternates: { languages },
    }));
  });
}

function latest(values: Array<string | null>): string | null {
  let best: string | null = null;
  for (const value of values) {
    if (value && (!best || new Date(value) > new Date(best))) best = value;
  }
  return best;
}

/** Only the production deployment may be indexed; previews and local dev disallow everything. */
export function buildRobots(
  siteUrl: string,
  env: Record<string, string | undefined> = process.env,
): MetadataRoute.Robots {
  if (env.VERCEL_ENV !== 'production') {
    return { rules: { userAgent: '*', disallow: '/' } };
  }
  const site = siteUrl.replace(/\/$/, '');
  return {
    rules: { userAgent: '*', allow: '/', disallow: ['/admin', '/api/', '/r/'] },
    sitemap: `${site}/sitemap.xml`,
    host: site,
  };
}
