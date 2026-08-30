import { defineRouting } from 'next-intl/routing';
import { PUBLIC_LOCALES } from '@hht/shared';

export const routing = defineRouting({
  locales: [...PUBLIC_LOCALES],
  defaultLocale: 'en',
  localePrefix: 'always',
});
