import { cache } from 'react';
import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { Stack } from '@mantine/core';

import { IssueView } from '@/components/IssueView';
import { TextLink } from '@/components/TextLink';
import type { IssueDetail } from '@/lib/issues';
import { getPublicSiteUrl } from '@/lib/siteUrl';

type Props = {
  params: Promise<{ locale: string; slug: string; issueId: string }>;
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

export default async function IssuePage({ params }: Props) {
  const { locale, slug, issueId } = await params;
  const t = await getTranslations('Issue');
  const baseUrl = getPublicSiteUrl();
  const issue = await fetchIssueDetail(baseUrl, slug, issueId, locale);

  if (issue === 'not-found') {
    notFound();
  }

  return (
    <Stack gap="lg" maw={720} mx="auto" w="100%">
      <TextLink href={`/projects/${slug}`} size="sm">
        {t('backToProject')}
      </TextLink>
      <IssueView issue={issue} locale={locale} />
    </Stack>
  );
}

export async function generateMetadata({ params }: Props) {
  const { locale, slug, issueId } = await params;
  const baseUrl = getPublicSiteUrl();
  const issue = await fetchIssueDetail(baseUrl, slug, issueId, locale);

  if (issue === 'not-found') {
    const t = await getTranslations({ locale, namespace: 'Issue' });
    return { title: t('notFound') };
  }

  return {
    title: issue.meta.title,
    description: issue.meta.description,
    openGraph: {
      title: issue.meta.title,
      description: issue.meta.description,
      type: 'article',
    },
    twitter: {
      card: 'summary_large_image',
      title: issue.meta.title,
      description: issue.meta.description,
    },
  };
}
