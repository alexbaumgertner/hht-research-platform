import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Anchor, Card, Stack, Text, Title } from '@mantine/core';
import { Link } from '@/i18n/routing';
import { getPublicSiteUrl } from '@/lib/siteUrl';

type Props = { params: Promise<{ locale: string }> };

async function fetchProjects(baseUrl: string) {
  const res = await fetch(`${baseUrl}/api/public/projects`, {
    cache: 'no-store',
  });
  if (!res.ok) return { docs: [] as Array<Record<string, string | null>> };
  return res.json() as Promise<{
    docs: Array<{
      id: string;
      slug: string;
      name: string;
      description: string | null;
      latestDigestPublishedAt: string | null;
    }>;
  }>;
}

export default async function HomePage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('Home');

  const { docs } = await fetchProjects(getPublicSiteUrl());

  return (
    <Stack gap="md">
      <div>
        <Title order={1}>{t('title')}</Title>
        <Text c="dimmed">{t('subtitle')}</Text>
      </div>

      {docs.length === 0 ? (
        <Text>{t('empty')}</Text>
      ) : (
        <Stack gap="sm">
          {docs.map((project) => (
            <Card key={project.id} padding="md" radius="md" withBorder>
              <Stack gap={4}>
                <Anchor component={Link} href={`/projects/${project.slug}`} fw={600} size="lg">
                  {project.name}
                </Anchor>
                {project.description ? <Text size="sm">{project.description}</Text> : null}
                {project.latestDigestPublishedAt ? (
                  <Text size="xs" c="dimmed">
                    {t('latestDigest')}:{' '}
                    {new Date(project.latestDigestPublishedAt).toLocaleDateString(locale)}
                  </Text>
                ) : null}
              </Stack>
            </Card>
          ))}
        </Stack>
      )}
    </Stack>
  );
}
