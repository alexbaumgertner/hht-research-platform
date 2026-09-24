import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { Stack, Text, Title } from '@mantine/core';
import { Suspense, cache } from 'react';

import { LatestIssueCard } from '@/components/LatestIssueCard';
import { MaterialsFeed } from '@/components/MaterialsFeed';
import { TextLink } from '@/components/TextLink';
import type { IssueSummaryListItem } from '@/lib/issues';
import type { Material } from '@/lib/materials';
import { buildPageMetadata, shareImagePath, toLocale } from '@/lib/metadata';
import { getPublicSiteUrl } from '@/lib/siteUrl';

type Props = {
  params: Promise<{ locale: string; slug: string }>;
};

const fetchProject = cache(async (baseUrl: string, slug: string) => {
  const res = await fetch(`${baseUrl}/api/public/projects/${slug}`, { cache: 'no-store' });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error('Failed to load project');
  return res.json() as Promise<{
    name: string;
    description: string | null;
    slug: string;
    lastSuccessfulRunAt: string | null;
  }>;
});

async function fetchMaterials(baseUrl: string, slug: string, locale: string) {
  const res = await fetch(
    `${baseUrl}/api/public/projects/${slug}/materials?locale=${encodeURIComponent(locale)}`,
    { cache: 'no-store' },
  );
  if (!res.ok) throw new Error('Failed to load materials');
  return res.json() as Promise<{ docs: Material[] }>;
}

async function fetchLatestIssue(
  baseUrl: string,
  slug: string,
  locale: string,
): Promise<IssueSummaryListItem | null> {
  const res = await fetch(
    `${baseUrl}/api/public/projects/${slug}/issues?limit=1&locale=${encodeURIComponent(locale)}`,
    { cache: 'no-store' },
  );
  if (!res.ok) return null;
  const body = (await res.json()) as { docs: IssueSummaryListItem[] };
  return body.docs[0] ?? null;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale: rawLocale, slug } = await params;
  const locale = toLocale(rawLocale);
  const project = await fetchProject(getPublicSiteUrl(), slug);
  if (!project) return {};

  const t = await getTranslations({ locale, namespace: 'Project' });
  return buildPageMetadata({
    locale,
    path: `/projects/${slug}`,
    title: project.name,
    description: t('metaDescription', { projectName: project.name }),
    type: 'website',
    image: {
      url: shareImagePath.project(locale, slug),
      alt: t('imageAlt', { projectName: project.name }),
    },
  });
}

export default async function ProjectFeedPage({ params }: Props) {
  const { locale, slug } = await params;
  const t = await getTranslations('Project');
  const baseUrl = getPublicSiteUrl();

  const project = await fetchProject(baseUrl, slug);
  if (!project) {
    return <Text>Not found</Text>;
  }

  const [{ docs }, latestIssue] = await Promise.all([
    fetchMaterials(baseUrl, slug, locale),
    fetchLatestIssue(baseUrl, slug, locale),
  ]);

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
        {project.lastSuccessfulRunAt ? (
          <Text size="xs" c="dimmed" mt="xs">
            {t('lastChecked', {
              date: new Date(project.lastSuccessfulRunAt).toLocaleDateString(locale, {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
              }),
            })}
          </Text>
        ) : null}
      </div>

      {latestIssue ? (
        <LatestIssueCard issue={latestIssue} projectSlug={slug} locale={locale} />
      ) : (
        <Text>{t('noIssuesYet')}</Text>
      )}

      <div>
        <Text fw={500}>{t('feedTitle')}</Text>
        <Suspense fallback={null}>
          <MaterialsFeed materials={docs} locale={locale} slug={slug} />
        </Suspense>
      </div>
    </Stack>
  );
}
