import { Card, Group, Stack, Text, Title } from '@mantine/core';
import { getTranslations } from 'next-intl/server';

import { TextLink } from '@/components/TextLink';
import { formatIssueDate, type IssueSummaryListItem } from '@/lib/issues';
import { toLocale } from '@/lib/metadata';

type Props = {
  issue: IssueSummaryListItem;
  projectSlug: string;
  locale: string;
};

export async function LatestIssueCard({ issue, projectSlug, locale }: Props) {
  const t = await getTranslations('Project');
  const dateLabel = formatIssueDate(issue.date, toLocale(locale));

  return (
    <Card
      padding="md"
      radius="md"
      withBorder
      component="section"
      aria-labelledby="latest-issue-heading"
    >
      <Stack gap="sm">
        <Title order={2} id="latest-issue-heading" size="h4">
          {t('latestIssueHeading')}
        </Title>
        <Text fw={600}>{dateLabel}</Text>
        {issue.excerpt ? (
          <Text size="sm" c="dimmed" style={{ overflowWrap: 'anywhere' }}>
            {issue.excerpt}
          </Text>
        ) : null}
        <Group gap="md">
          <TextLink href={`/projects/${projectSlug}/issues/${issue.id}`}>{t('readIssue')}</TextLink>
          <TextLink href={`/projects/${projectSlug}/issues`} size="sm" c="dimmed">
            {t('allIssues')}
          </TextLink>
        </Group>
      </Stack>
    </Card>
  );
}
