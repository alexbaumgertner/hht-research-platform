'use client';

import { Badge, ThemeIcon } from '@mantine/core';
import {
  IconBook2,
  IconNews,
  IconFlask2,
  IconShare,
  IconClipboardList,
  IconHelpCircle,
} from '@tabler/icons-react';
import { useTranslations } from 'next-intl';

import type { MaterialSourceOrFallback } from '@/lib/materials';

const SOURCE_META: Record<MaterialSourceOrFallback, { icon: typeof IconBook2; color: string }> = {
  pubmed: { icon: IconBook2, color: 'teal' },
  trials: { icon: IconFlask2, color: 'violet' },
  news: { icon: IconNews, color: 'blue' },
  guideline: { icon: IconClipboardList, color: 'orange' },
  social: { icon: IconShare, color: 'pink' },
  unknown: { icon: IconHelpCircle, color: 'gray' },
};

export function SourceBadge({ source }: { source: MaterialSourceOrFallback }) {
  const t = useTranslations('Materials');
  const meta = SOURCE_META[source] ?? SOURCE_META.unknown;
  const Icon = meta.icon;
  const label =
    source === 'pubmed' ||
    source === 'trials' ||
    source === 'news' ||
    source === 'guideline' ||
    source === 'social'
      ? t(`badge.${source}`)
      : t('badge.unknown');

  return (
    <Badge
      variant="light"
      color={meta.color}
      leftSection={
        <ThemeIcon variant="transparent" color={meta.color} size="xs" aria-hidden>
          <Icon size={14} stroke={1.75} />
        </ThemeIcon>
      }
      tt="none"
    >
      {label}
    </Badge>
  );
}
