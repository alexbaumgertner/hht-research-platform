import { defineRouting } from 'next-intl/routing';
import { createNavigation } from 'next-intl/navigation';
import { PUBLIC_LOCALES } from '@hht/shared';

export const routing = defineRouting({
  locales: [...PUBLIC_LOCALES],
  defaultLocale: 'en',
  localePrefix: 'always',
});

export const { Link, redirect, usePathname, useRouter, getPathname } = createNavigation(routing);
