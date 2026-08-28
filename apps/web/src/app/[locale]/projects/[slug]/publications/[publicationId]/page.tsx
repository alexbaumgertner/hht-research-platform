import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Anchor, Stack, Text, Title } from '@mantine/core';
import { TextLink } from '@/components/TextLink';
import { getPublicSiteUrl } from '@/lib/siteUrl';

type Props = {
  params: Promise<{ locale: string; slug: string; publicationId: string }>;
};

type PublicationResponse = {
  id: string;
  title: string;
  originalUrl: string;
  importance: string | null;
  locale: string;
  summary: {
    objective: string;
    methods: string;
    results: string;
    limitations: string;
    whyItMatters: string;
  };
  translationFallbackUrl: string | null;
};

async function fetchPublication(baseUrl: string, id: string, locale: string) {
  const res = await fetch(
    `${baseUrl}/api/public/publications/${id}?locale=${encodeURIComponent(locale)}`,
    { cache: 'no-store' },
  );
  if (!res.ok) return null;
  return res.json() as Promise<PublicationResponse>;
}

export default async function PublicationPage({ params }: Props) {
  const { locale, slug, publicationId } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('Publication');
  const baseUrl = getPublicSiteUrl();
  const pub = await fetchPublication(baseUrl, publicationId, locale);

  if (!pub) {
    return <Text>Not found</Text>;
  }

  const sections = [
    { key: 'objective' as const, label: t('objective') },
    { key: 'methods' as const, label: t('methods') },
    { key: 'results' as const, label: t('results') },
    { key: 'limitations' as const, label: t('limitations') },
    { key: 'whyItMatters' as const, label: t('whyItMatters') },
  ];

  return (
    <Stack gap="lg">
      <TextLink href={`/projects/${slug}`} size="sm">
        {t('backToFeed')}
      </TextLink>
      <Title order={1}>{pub.title}</Title>
      <Anchor href={pub.originalUrl} target="_blank" rel="noopener noreferrer">
        {t('originalLink')}
      </Anchor>
      {pub.translationFallbackUrl ? (
        <Anchor href={pub.translationFallbackUrl} target="_blank" rel="noopener noreferrer">
          {t('translationFallback')}
        </Anchor>
      ) : null}
      {sections.map((section) => (
        <Stack key={section.key} gap={4}>
          <Title order={3}>{section.label}</Title>
          <Text>{pub.summary[section.key]}</Text>
        </Stack>
      ))}
    </Stack>
  );
}
