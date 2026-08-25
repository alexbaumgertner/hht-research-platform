'use client';

import { Select } from '@mantine/core';
import { useRouter } from '@/i18n/routing';
import { useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';

const LEVELS = ['critical', 'high', 'medium', 'low'] as const;

export function ImportanceFilter({ slug }: { slug: string }) {
  const t = useTranslations('Project');
  const router = useRouter();
  const searchParams = useSearchParams();
  const current = searchParams.get('importance') || '';

  return (
    <Select
      label={t('filterLabel')}
      clearable
      placeholder={t('filterAll')}
      value={current || null}
      data={LEVELS.map((level) => ({
        value: level,
        label: t(`importance.${level}`),
      }))}
      onChange={(value) => {
        const qs = value ? `?importance=${value}` : '';
        router.push(`/projects/${slug}${qs}`);
      }}
      w={220}
    />
  );
}
