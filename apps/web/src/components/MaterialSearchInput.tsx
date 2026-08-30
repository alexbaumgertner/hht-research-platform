'use client';

import { TextInput } from '@mantine/core';
import { IconSearch } from '@tabler/icons-react';
import { useTranslations } from 'next-intl';

type Props = {
  value: string;
  onChange: (value: string) => void;
};

export function MaterialSearchInput({ value, onChange }: Props) {
  const t = useTranslations('Materials');

  return (
    <TextInput
      aria-label={t('search')}
      label={t('search')}
      placeholder={t('searchPlaceholder')}
      value={value}
      onChange={(event) => onChange(event.currentTarget.value)}
      leftSection={<IconSearch size={16} stroke={1.75} aria-hidden />}
      leftSectionPointerEvents="none"
      w="100%"
    />
  );
}
