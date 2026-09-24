import type { Metadata } from 'next';
import { hasLocale } from 'next-intl';
import { getTranslations } from 'next-intl/server';

import { PUBLIC_LOCALES, type Locale } from '@hht/shared';

import { routing } from '@/i18n/routing';
import { getPublicSiteUrl } from '@/lib/siteUrl';

export const SHARE_IMAGE_SIZE = { width: 1200, height: 630 } as const;
export const SHARE_IMAGE_TYPE = 'image/png';

const OPEN_GRAPH_LOCALE: Record<Locale, string> = {
  en: 'en_US',
  de: 'de_DE',
  tr: 'tr_TR',
  ru: 'ru_RU',
  uk: 'uk_UA',
};

export function toLocale(value: string): Locale {
  return hasLocale(routing.locales, value) ? value : routing.defaultLocale;
}

/**
 * Paths of the `opengraph-image` routes. Pages reference them explicitly because a page's own
 * `openGraph` object replaces its parent's, which would otherwise drop the inherited image.
 */
export const shareImagePath = {
  site: (locale: Locale) => `/${locale}/opengraph-image`,
  project: (locale: Locale, slug: string) => `/${locale}/projects/${slug}/opengraph-image`,
  issue: (locale: Locale, slug: string, issueId: string) =>
    `/${locale}/projects/${slug}/issues/${issueId}/opengraph-image`,
};

export async function buildRootMetadata(locale: Locale): Promise<Metadata> {
  const t = await getTranslations({ locale, namespace: 'Site' });
  const siteName = t('name');

  return {
    metadataBase: new URL(getPublicSiteUrl()),
    title: { template: `%s · ${siteName}`, default: siteName },
    description: t('description'),
    openGraph: {
      type: 'website',
      siteName,
      locale: OPEN_GRAPH_LOCALE[locale],
    },
    twitter: { card: 'summary_large_image' },
  };
}

export type PageMetadataInput = {
  locale: Locale;
  /** Path without the locale prefix: `''` for home, `/projects/{slug}`, … */
  path: string;
  title: string;
  description: string;
  type: 'website' | 'article';
  image: { url: string; alt: string };
};

export async function buildPageMetadata(input: PageMetadataInput): Promise<Metadata> {
  const t = await getTranslations({ locale: input.locale, namespace: 'Site' });
  const url = `/${input.locale}${input.path}`;

  return {
    title: input.title,
    description: input.description,
    alternates: {
      canonical: url,
      languages: Object.fromEntries(
        PUBLIC_LOCALES.map((locale) => [locale, `/${locale}${input.path}`]),
      ),
    },
    openGraph: {
      type: input.type,
      title: input.title,
      description: input.description,
      url,
      siteName: t('name'),
      locale: OPEN_GRAPH_LOCALE[input.locale],
      images: [
        {
          url: input.image.url,
          alt: input.image.alt,
          type: SHARE_IMAGE_TYPE,
          ...SHARE_IMAGE_SIZE,
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title: input.title,
      description: input.description,
    },
  };
}
