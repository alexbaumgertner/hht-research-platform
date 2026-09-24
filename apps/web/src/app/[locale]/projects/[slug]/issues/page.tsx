import type { Metadata } from 'next';
import { cache } from 'react';
import { getTranslations } from 'next-intl/server';
import { Stack, Title } from '@mantine/core';

import { IssueArchiveList } from '@/components/IssueArchiveList';
import { TextLink } from '@/components/TextLink';
import type { IssueSummaryListItem } from '@/lib/issues';
import { buildPageMetadata, shareImagePath, toLocale } from '@/lib/metadata';
import { getPublicSiteUrl } from '@/lib/siteUrl';

type Props = {
  params: Promise<{ locale: string; slug: string }>;
};

const fetchProject = cache(async (baseUrl: string, slug: string) => {
  const res = await fetch(`${baseUrl}/api/public/projects/${slug}`, { cache: 'no-store' });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error('Failed to load project');
  return res.json() as Promise<{ name: string; slug: string }>;
});

async function fetchIssuesUncached(
  baseUrl: string,
  slug: string,
  locale: string,
): Promise<IssueSummaryListItem[]> {
  const res = await fetch(
    `${baseUrl}/api/public/projects/${slug}/issues?locale=${encodeURIComponent(locale)}`,
    { cache: 'no-store' },
  );
  if (res.status === 404) return [];
  if (!res.ok) throw new Error('Failed to load issues');
  const body = (await res.json()) as { docs: IssueSummaryListItem[] };
  return body.docs;
}

const fetchIssues = cache((baseUrl: string, slug: string, locale: string) =>
  fetchIssuesUncached(baseUrl, slug, locale),
);

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale: rawLocale, slug } = await params;
  const locale = toLocale(rawLocale);
  const project = await fetchProject(getPublicSiteUrl(), slug);
  if (!project) return {};

  const [tIssue, tProject] = await Promise.all([
    getTranslations({ locale, namespace: 'Issue' }),
    getTranslations({ locale, namespace: 'Project' }),
  ]);

  return buildPageMetadata({
    locale,
    path: `/projects/${slug}/issues`,
    title: tIssue('archiveMetaTitle', { projectName: project.name }),
    description: tProject('metaDescription', { projectName: project.name }),
    type: 'website',
    image: {
      url: shareImagePath.project(locale, slug),
      alt: tProject('imageAlt', { projectName: project.name }),
    },
  });
}

export default async function IssueArchivePage({ params }: Props) {
  const { locale, slug } = await params;
  const t = await getTranslations('Issue');
  const baseUrl = getPublicSiteUrl();

  const [project, issues] = await Promise.all([
    fetchProject(baseUrl, slug),
    fetchIssues(baseUrl, slug, locale),
  ]);

  if (!project) {
    return null;
  }

  return (
    <Stack gap="lg" maw={720} mx="auto" w="100%">
      <TextLink href={`/projects/${slug}`} size="sm">
        {t('backToProject')}
      </TextLink>
      <Title order={1}>{t('archiveTitle', { projectName: project.name })}</Title>
      <IssueArchiveList issues={issues} projectSlug={slug} locale={locale} />
    </Stack>
  );
}
