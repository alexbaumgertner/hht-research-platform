'use client';

import { Select } from '@mantine/core';
import { useLocale, useTranslations } from 'next-intl';
import { usePathname, useRouter } from '@/i18n/routing';
import { PUBLIC_LOCALES } from '@hht/shared';

const LABELS: Record<string, string> = {
  en: 'English',
  de: 'Deutsch',
  tr: 'Türkçe',
  ru: 'Русский',
  uk: 'Українська',
};

export function LocaleSwitcher() {
  const t = useTranslations('LocaleSwitcher');
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();

  return (
    <Select
      aria-label={t('label')}
      label={t('label')}
      data={PUBLIC_LOCALES.map((code) => ({ value: code, label: LABELS[code] ?? code }))}
      value={locale}
      onChange={(value) => {
        if (!value) return;
        router.replace(pathname, { locale: value });
      }}
      allowDeselect={false}
      w={180}
    />
  );
}
