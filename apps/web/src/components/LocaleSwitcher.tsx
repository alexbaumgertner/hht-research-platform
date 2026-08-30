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
        // Read query from the live URL so we do not need useSearchParams
        // (which forces a Suspense boundary and can hide this control on first paint).
        const qs = typeof window !== 'undefined' ? window.location.search.replace(/^\?/, '') : '';
        const href = qs ? `${pathname}?${qs}` : pathname;
        router.replace(href, { locale: value });
      }}
      allowDeselect={false}
      w={180}
    />
  );
}
