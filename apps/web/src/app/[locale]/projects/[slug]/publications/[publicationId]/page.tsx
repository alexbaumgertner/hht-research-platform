import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { Stack } from '@mantine/core';

import { MaterialDetailView } from '@/components/MaterialDetailView';
import { TextLink } from '@/components/TextLink';
import type { MaterialDetail } from '@/lib/materials';
import { getPublicSiteUrl } from '@/lib/siteUrl';

type Props = {
  params: Promise<{ locale: string; slug: string; publicationId: string }>;
};

async function fetchMaterialDetail(
  baseUrl: string,
  slug: string,
  id: string,
  locale: string,
): Promise<MaterialDetail | 'not-found'> {
  const res = await fetch(
    `${baseUrl}/api/public/projects/${slug}/materials/${id}?locale=${encodeURIComponent(locale)}`,
    { cache: 'no-store' },
  );
  if (res.status === 404) return 'not-found';
  if (!res.ok) throw new Error('Failed to load material');
  return res.json() as Promise<MaterialDetail>;
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
