'use client';

import { Box, Group, Stack, Text } from '@mantine/core';
import { useTranslations } from 'next-intl';

import { SourceBadge } from '@/components/SourceBadge';
import type { Material } from '@/lib/materials';

type Props = {
  material: Material;
  locale: string;
};

export function MaterialCard({ material, locale }: Props) {
  const t = useTranslations('Materials');
  const isHigh = material.importance === 'high';
  const dateLabel = material.date
    ? new Date(material.date).toLocaleDateString(locale, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      })
    : null;

  const titleContent = material.url ? (
    <a
      href={material.url}
      target="_blank"
      rel="noopener noreferrer"
      style={{ fontWeight: 600, color: 'inherit', textDecoration: 'underline' }}
    >
      {material.title}
      <Text component="span" size="xs" c="dimmed" ml={6}>
        {t('opensInNewTab')}
      </Text>
    </a>
  ) : (
    <Text fw={600}>{material.title}</Text>
  );

  return (
    <Box
      component="article"
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
          <SourceBadge source={material.source} />
          {isHigh ? (
            <Text size="xs" c="dimmed" fw={500}>
              {t('highImportance')}
            </Text>
          ) : null}
          {dateLabel ? (
            <Text size="xs" c="dimmed">
              {dateLabel}
            </Text>
          ) : null}
        </Group>
        {titleContent}
        {material.summary ? (
          <Text size="sm" c="dimmed" lineClamp={3}>
            {material.summary}
          </Text>
        ) : null}
        {material.isFallback ? (
          <Text size="xs" c="dimmed" fs="italic">
            {t('fallbackNote')}
          </Text>
        ) : null}
      </Stack>
    </Box>
  );
}
