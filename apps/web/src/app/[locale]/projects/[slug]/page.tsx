import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Anchor, Badge, Group, Stack, Text, Title } from '@mantine/core';
import { Suspense } from 'react';
import { Link } from '@/i18n/routing';
import { ImportanceFilter } from '@/components/ImportanceFilter';
import { getPublicSiteUrl } from '@/lib/siteUrl';

type Props = {
  params: Promise<{ locale: string; slug: string }>;
  searchParams: Promise<{ importance?: string }>;
};

async function fetchProject(baseUrl: string, slug: string) {
  const res = await fetch(`${baseUrl}/api/public/projects/${slug}`, { cache: 'no-store' });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error('Failed to load project');
  return res.json() as Promise<{ name: string; description: string | null; slug: string }>;
}

async function fetchDigests(baseUrl: string, slug: string, importance?: string) {
  const qs = importance ? `?importance=${encodeURIComponent(importance)}` : '';
  const res = await fetch(`${baseUrl}/api/public/projects/${slug}/digests${qs}`, {
    cache: 'no-store',
  });
  if (!res.ok) return { docs: [] };
  return res.json() as Promise<{
    docs: Array<{
      id: string;
      publishedAt: string;
      publications: Array<{
        id: string;
        title: string;
        importance: string | null;
        originalUrl: string;
        summaryPreview: string | null;
      }>;
    }>;
  }>;
}

export default async function ProjectFeedPage({ params, searchParams }: Props) {
  const { locale, slug } = await params;
  const { importance } = await searchParams;
  setRequestLocale(locale);
  const t = await getTranslations('Project');
  const baseUrl = getPublicSiteUrl();

  const project = await fetchProject(baseUrl, slug);
  if (!project) {
    return <Text>Not found</Text>;
  }

  const { docs } = await fetchDigests(baseUrl, slug, importance);

  return (
    <Stack gap="lg">
      <div>
        <Anchor component={Link} href="/" size="sm">
          {t('backHome')}
        </Anchor>
        <Title order={1} mt="xs">
          {project.name}
        </Title>
        {project.description ? <Text c="dimmed">{project.description}</Text> : null}
        <Text mt="sm" fw={500}>
          {t('feedTitle')}
        </Text>
      </div>

      <Suspense fallback={null}>
        <ImportanceFilter slug={slug} />
      </Suspense>

      {docs.length === 0 ? (
        <Text>{t('empty')}</Text>
      ) : (
        <Stack gap="xl">
          {docs.map((digest) => (
            <Stack key={digest.id} gap="sm">
              <Text size="sm" c="dimmed">
                {new Date(digest.publishedAt).toLocaleString(locale)}
              </Text>
              {digest.publications.map((pub) => (
                <Group key={pub.id} justify="space-between" align="flex-start" wrap="nowrap">
                  <Stack gap={4}>
                    <Anchor
                      component={Link}
                      href={`/projects/${slug}/publications/${pub.id}`}
                      fw={600}
                    >
                      {pub.title}
                    </Anchor>
                    {pub.summaryPreview ? (
                      <Text size="sm" lineClamp={2}>
                        {pub.summaryPreview}
                      </Text>
                    ) : null}
                  </Stack>
                  {pub.importance ? (
                    <Badge variant="light">
                      {t(`importance.${pub.importance}` as 'importance.high')}
                    </Badge>
                  ) : null}
                </Group>
              ))}
            </Stack>
          ))}
        </Stack>
      )}
    </Stack>
  );
}
