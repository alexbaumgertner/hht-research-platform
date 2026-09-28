import type { Metadata } from 'next';
import { cache } from 'react';
import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { Stack } from '@mantine/core';

import { IssueView } from '@/components/IssueView';
import { SubscribeForm } from '@/components/SubscribeForm';
import { TextLink } from '@/components/TextLink';
import { incrementAnalyticsCount } from '@/lib/analyticsCounts';
import type { IssueDetail } from '@/lib/issues';
import { findProjectBySlug } from '@/lib/issueQueries';
import { buildPageMetadata, shareImagePath, toLocale } from '@/lib/metadata';
import { getPublicSiteUrl } from '@/lib/siteUrl';

type Props = {
  params: Promise<{ locale: string; slug: string; issueId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

async function fetchIssueDetailUncached(
  baseUrl: string,
  slug: string,
  issueId: string,
  locale: string,
): Promise<IssueDetail | 'not-found'> {
  const res = await fetch(
    `${baseUrl}/api/public/projects/${slug}/issues/${issueId}?locale=${encodeURIComponent(locale)}`,
    { cache: 'no-store' },
  );
  if (res.status === 404) return 'not-found';
  if (!res.ok) throw new Error('Failed to load issue');
  return res.json() as Promise<IssueDetail>;
}

const fetchIssueDetail = cache((baseUrl: string, slug: string, issueId: string, locale: string) =>
  fetchIssueDetailUncached(baseUrl, slug, issueId, locale),
);

export default async function IssuePage({ params, searchParams }: Props) {
  const { locale, slug, issueId } = await params;
  const query = await searchParams;
  const notice = typeof query.notice === 'string' ? query.notice : null;
  const src = typeof query.src === 'string' ? query.src : null;
  const t = await getTranslations('Issue');
  const baseUrl = getPublicSiteUrl();
  const issue = await fetchIssueDetail(baseUrl, slug, issueId, locale);

  if (issue === 'not-found') {
    notFound();
  }

  const project = await findProjectBySlug(slug);
  if (project) {
    await incrementAnalyticsCount({
      projectId: project.id,
      issueKey: issueId,
      source: src,
      metric: 'page_view',
    });
  }

  return (
    <Stack gap="lg" maw={720} mx="auto" w="100%">
      <TextLink href={`/projects/${slug}`} size="sm">
        {t('backToProject')}
      </TextLink>
      <IssueView issue={issue} locale={locale} />
      <SubscribeForm
        projectName={issue.project.name}
        projectSlug={slug}
        locale={locale}
        notice={notice}
        issueId={issueId}
      />
    </Stack>
  );
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale: rawLocale, slug, issueId } = await params;
  const locale = toLocale(rawLocale);
  const [issue, t] = await Promise.all([
    fetchIssueDetail(getPublicSiteUrl(), slug, issueId, locale),
    getTranslations({ locale, namespace: 'Issue' }),
  ]);

  if (issue === 'not-found') {
    return { title: t('notFound') };
  }

  return buildPageMetadata({
    locale,
    path: `/projects/${slug}/issues/${issueId}`,
    title: issue.meta.title,
    description: issue.meta.description,
    type: 'article',
    image: {
      url: shareImagePath.issue(locale, slug, issueId),
      alt: t('imageAlt', { projectName: issue.project.name }),
    },
  });
}
