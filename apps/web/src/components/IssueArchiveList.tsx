import { Stack, Text } from '@mantine/core';
import { getTranslations } from 'next-intl/server';

import { TextLink } from '@/components/TextLink';
import { formatIssueDate, type IssueSummaryListItem } from '@/lib/issues';
import { toLocale } from '@/lib/metadata';

type Props = {
  issues: IssueSummaryListItem[];
  projectSlug: string;
  locale: string;
};

const rowStyle = { overflowWrap: 'anywhere' as const };

export async function IssueArchiveList({ issues, projectSlug, locale }: Props) {
  const t = await getTranslations('Issue');

  if (issues.length === 0) {
    return <Text>{t('archiveEmpty')}</Text>;
  }

  return (
    <Stack component="ul" gap="md" style={{ margin: 0, padding: 0, listStyle: 'none' }}>
      {issues.map((issue) => {
        const dateLabel = formatIssueDate(issue.date, toLocale(locale));

        return (
          <Stack key={issue.id} component="li" gap={4} style={rowStyle}>
            <TextLink href={`/projects/${projectSlug}/issues/${issue.id}`} fw={600}>
              {dateLabel}
            </TextLink>
            <Text size="sm" c="dimmed">
              {t('itemCount', { count: issue.itemCount })}
            </Text>
            {issue.excerpt ? (
              <Text size="sm" c="dimmed">
                {issue.excerpt}
              </Text>
            ) : null}
          </Stack>
        );
      })}
    </Stack>
  );
}
