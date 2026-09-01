import { Anchor, Box, Group, Stack, Text, Title } from '@mantine/core';
import { getTranslations } from 'next-intl/server';

import { SourceBadge } from '@/components/SourceBadge';
import { SUMMARY_SECTION_KEYS, type MaterialDetail, type SummarySectionKey } from '@/lib/materials';

type Props = {
  detail: MaterialDetail;
  locale: string;
};

export async function MaterialDetailView({ detail, locale }: Props) {
  const t = await getTranslations('Publication');
  const tMaterials = await getTranslations('Materials');
  const isHigh = detail.importance === 'high';
  const dateLabel = detail.date
    ? new Date(detail.date).toLocaleDateString(locale, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      })
    : null;

  const originalAria = `${t('originalLink')} ${tMaterials('opensInNewTab')}`;

  return (
    <Stack gap="lg" maw={720} mx="auto" w="100%">
      <Box
        py="md"
        px="sm"
        style={{
          borderLeft: isHigh ? '3px solid var(--mantine-color-teal-5)' : '3px solid transparent',
          background: isHigh ? 'var(--mantine-color-teal-light)' : undefined,
          borderRadius: 'var(--mantine-radius-sm)',
        }}
      >
        <Stack gap="xs">
          <Group gap="sm" wrap="wrap">
            <SourceBadge source={detail.source} />
            {isHigh ? (
              <Text size="xs" c="dimmed" fw={500}>
                {tMaterials('highImportance')}
              </Text>
            ) : null}
            {dateLabel ? (
              <Text size="xs" c="dimmed">
                {dateLabel}
              </Text>
            ) : null}
          </Group>
          <Title order={1}>{detail.title}</Title>
          {detail.originalUrl ? (
            <Anchor
              href={detail.originalUrl}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={originalAria}
              w="fit-content"
            >
              {t('originalLink')}
            </Anchor>
          ) : null}
        </Stack>
      </Box>

      {detail.isFallback ? (
        <Text size="xs" c="dimmed" fs="italic">
          {tMaterials('fallbackNote')}
        </Text>
      ) : null}

      {SUMMARY_SECTION_KEYS.map((key: SummarySectionKey) => {
        const body = detail.summary[key];
        if (!body) return null;
        return (
          <Stack key={key} gap={4}>
            <Title order={3}>{t(key)}</Title>
            <Text>{body}</Text>
          </Stack>
        );
      })}

      {detail.abstractOrBody ? (
        <Stack gap={4}>
          <Title order={3}>{t('abstractHeading')}</Title>
          {detail.abstractIsFallback ? (
            <Text size="xs" c="dimmed" fs="italic">
              {tMaterials('fallbackNote')}
            </Text>
          ) : null}
          <Text style={{ whiteSpace: 'pre-wrap' }}>{detail.abstractOrBody}</Text>
        </Stack>
      ) : null}
    </Stack>
  );
}
