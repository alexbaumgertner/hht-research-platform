'use client';

import { Switch } from '@mantine/core';
import { useTranslations } from 'next-intl';

type Props = {
  checked: boolean;
  onChange: (checked: boolean) => void;
};

export function HighImportanceSwitch({ checked, onChange }: Props) {
  const t = useTranslations('Materials');

  return (
    <Switch
      label={t('importanceToggle')}
      checked={checked}
      onChange={(event) => onChange(event.currentTarget.checked)}
    />
  );
}
