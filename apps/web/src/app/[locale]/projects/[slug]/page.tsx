import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Stack, Text, Title } from '@mantine/core';
import { Suspense } from 'react';

import { MaterialsFeed } from '@/components/MaterialsFeed';
import { TextLink } from '@/components/TextLink';
import type { Material } from '@/lib/materials';
import { getPublicSiteUrl } from '@/lib/siteUrl';

type Props = {
  params: Promise<{ locale: string; slug: string }>;
};

async function fetchProject(baseUrl: string, slug: string) {
  const res = await fetch(`${baseUrl}/api/public/projects/${slug}`, { cache: 'no-store' });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error('Failed to load project');
  return res.json() as Promise<{ name: string; description: string | null; slug: string }>;
}

async function fetchMaterials(baseUrl: string, slug: string, locale: string) {
  const res = await fetch(
    `${baseUrl}/api/public/projects/${slug}/materials?locale=${encodeURIComponent(locale)}`,
    { cache: 'no-store' },
  );
  if (!res.ok) throw new Error('Failed to load materials');
  return res.json() as Promise<{ docs: Material[] }>;
}

export default async function ProjectFeedPage({ params }: Props) {
  const { locale, slug } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('Project');
  const baseUrl = getPublicSiteUrl();

  const project = await fetchProject(baseUrl, slug);
  if (!project) {
    return <Text>Not found</Text>;
  }

  const { docs } = await fetchMaterials(baseUrl, slug, locale);

  return (
    <Stack gap="lg" maw={720} mx="auto" w="100%">
      <div>
        <TextLink href="/" size="sm">
          {t('backHome')}
        </TextLink>
        <Title order={1} mt="xs">
          {project.name}
        </Title>
        {project.description ? <Text c="dimmed">{project.description}</Text> : null}
        <Text mt="sm" fw={500}>
          {t('feedTitle')}
        </Text>
      </div>

      <Suspense fallback={null}>
        <MaterialsFeed materials={docs} locale={locale} />
      </Suspense>
    </Stack>
  );
}
