import type { Metadata } from 'next';
import { cache } from 'react';
import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { Stack } from '@mantine/core';

import { MaterialDetailView } from '@/components/MaterialDetailView';
import { TextLink } from '@/components/TextLink';
import { truncateDescription } from '@/lib/issues';
import type { MaterialDetail } from '@/lib/materials';
import { buildPageMetadata, shareImagePath, toLocale } from '@/lib/metadata';
import { getPublicSiteUrl } from '@/lib/siteUrl';

type Props = {
  params: Promise<{ locale: string; slug: string; publicationId: string }>;
};

const fetchMaterialDetail = cache(
  async (
    baseUrl: string,
    slug: string,
    id: string,
    locale: string,
  ): Promise<MaterialDetail | 'not-found'> => {
    const res = await fetch(
      `${baseUrl}/api/public/projects/${slug}/materials/${id}?locale=${encodeURIComponent(locale)}`,
      { cache: 'no-store' },
    );
    if (res.status === 404) return 'not-found';
    if (!res.ok) throw new Error('Failed to load material');
    return res.json() as Promise<MaterialDetail>;
  },
);

async function fetchProjectName(baseUrl: string, slug: string): Promise<string | null> {
  const res = await fetch(`${baseUrl}/api/public/projects/${slug}`, { cache: 'no-store' });
  if (!res.ok) return null;
  const project = (await res.json()) as { name?: string };
  return project.name ?? null;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale: rawLocale, slug, publicationId } = await params;
  const locale = toLocale(rawLocale);
  const baseUrl = getPublicSiteUrl();
  const [detail, projectName, tProject, tPublication] = await Promise.all([
    fetchMaterialDetail(baseUrl, slug, publicationId, locale),
    fetchProjectName(baseUrl, slug),
    getTranslations({ locale, namespace: 'Project' }),
    getTranslations({ locale, namespace: 'Publication' }),
  ]);

  if (detail === 'not-found') {
    return { title: tPublication('notFound') };
  }

  const name = projectName ?? slug;
  const objective = detail.summary.objective?.trim();

  return buildPageMetadata({
    locale,
    path: `/projects/${slug}/publications/${publicationId}`,
    title: detail.title,
    description: objective
      ? truncateDescription(objective)
      : tProject('metaDescription', { projectName: name }),
    type: 'article',
    image: {
      url: shareImagePath.project(locale, slug),
      alt: tProject('imageAlt', { projectName: name }),
    },
  });
}

export default async function PublicationPage({ params }: Props) {
  const { locale, slug, publicationId } = await params;
  const t = await getTranslations('Publication');
  const baseUrl = getPublicSiteUrl();
  const detail = await fetchMaterialDetail(baseUrl, slug, publicationId, locale);

  if (detail === 'not-found') {
    notFound();
  }

  return (
    <Stack gap="lg" maw={720} mx="auto" w="100%">
      <TextLink href={`/projects/${slug}`} size="sm">
        {t('backToFeed')}
      </TextLink>
      <MaterialDetailView detail={detail} locale={locale} />
    </Stack>
  );
}
