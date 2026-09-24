import type { CSSProperties } from 'react';
import { Group, Stack, Text, Title } from '@mantine/core';
import { getTranslations } from 'next-intl/server';

import { SourceBadge } from '@/components/SourceBadge';
import { TextLink } from '@/components/TextLink';
import { TrustNotice } from '@/components/TrustNotice';
import type { IssueDetail } from '@/lib/issues';

// Native lists: Mantine `List` overflows a 360 px viewport by a few pixels (FR-016), and
// its `List.Item` is undefined in a server component.
const listStyle = (gap: string): CSSProperties => ({
  margin: 0,
  paddingInlineStart: '1.5rem',
  display: 'grid',
  gap,
});
const itemStyle: CSSProperties = { overflowWrap: 'anywhere' };

type Props = {
  issue: IssueDetail;
  locale: string;
};

export async function IssueView({ issue, locale }: Props) {
  const t = await getTranslations('Issue');
  const dateLabel = new Date(issue.date).toLocaleDateString(locale, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
  const positionById = new Map(issue.items.map((item, index) => [item.id, index + 1]));
  const textLang = issue.isFallback ? issue.displayedLocale : undefined;

  return (
    <Stack gap="lg" maw={720} mx="auto" w="100%">
      <Title order={1}>{t('heading', { projectName: issue.project.name, date: dateLabel })}</Title>

      <Stack gap="sm" component="section" aria-labelledby="issue-summary-heading">
        <Title order={2} id="issue-summary-heading">
          {t('summaryHeading')}
        </Title>

        {issue.isFallback ? (
          <Text size="sm" c="dimmed" role="note">
            {issue.translation.status === 'pending'
              ? t('translationPending')
              : t('translationUnavailable')}
          </Text>
        ) : null}

        {issue.summary ? (
          <ol style={listStyle('var(--mantine-spacing-sm)')} lang={textLang}>
            {issue.summary.points.map((point) => (
              <li key={point.text} style={itemStyle}>
                <Text component="span">{point.text}</Text>
                {point.itemIds.length > 0 ? (
                  <Text component="span" size="sm" c="dimmed">
                    {' '}
                    {t('basedOn')}{' '}
                    {point.itemIds.map((itemId, index) => {
                      const position = positionById.get(itemId);
                      return (
                        <Text
                          key={itemId}
                          component="a"
                          href={`#item-${itemId}`}
                          size="sm"
                          c="teal"
                        >
                          {position ?? index + 1}
                          {index < point.itemIds.length - 1 ? ', ' : ''}
                        </Text>
                      );
                    })}
                  </Text>
                ) : null}
              </li>
            ))}
          </ol>
        ) : (
          <Text>{t('summaryUnavailable')}</Text>
        )}
      </Stack>

      <TrustNotice />

      <Stack gap="sm" component="section" aria-labelledby="issue-items-heading">
        <Title order={2} id="issue-items-heading">
          {t('itemsHeading')}
        </Title>

        <ol style={listStyle('var(--mantine-spacing-md)')}>
          {issue.items.map((item) => {
            const itemDate = item.date
              ? new Date(item.date).toLocaleDateString(locale, {
                  year: 'numeric',
                  month: 'short',
                  day: 'numeric',
                })
              : null;

            return (
              <li key={item.id} id={`item-${item.id}`} style={itemStyle}>
                <Stack gap={4}>
                  <TextLink href={`/projects/${issue.project.slug}/publications/${item.id}`}>
                    {item.title}
                  </TextLink>
                  <Group gap="sm" wrap="wrap">
                    <SourceBadge source={item.source} />
                    {item.isTrialRegistration ? (
                      <Text size="xs" c="dimmed">
                        {t('trialLabel')}
                      </Text>
                    ) : null}
                    {itemDate ? (
                      <Text size="xs" c="dimmed">
                        {itemDate}
                      </Text>
                    ) : null}
                  </Group>
                  {item.sentence ? <Text lang={textLang}>{item.sentence}</Text> : null}
                </Stack>
              </li>
            );
          })}
        </ol>
      </Stack>

      <TextLink href={`/projects/${issue.project.slug}/issues`} size="sm">
        {t('archiveTitle', { projectName: issue.project.name })}
      </TextLink>
    </Stack>
  );
}
