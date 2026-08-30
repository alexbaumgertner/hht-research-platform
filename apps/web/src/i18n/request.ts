import * as rootParams from 'next/root-params';
import { hasLocale } from 'next-intl';
import { getRequestConfig } from 'next-intl/server';
import { notFound } from 'next/navigation';

import { PUBLIC_LOCALES, type Locale } from '@hht/shared';

import { routing } from './routing';

export const locales = PUBLIC_LOCALES;
export const defaultLocale: Locale = 'en';

export default getRequestConfig(async ({ locale }) => {
  // Prefer an explicit override; otherwise read [locale] via next/root-params
  // (replaces deprecated setRequestLocale / setCachedRequestLocale).
  if (!locale) {
    const paramValue = await rootParams.locale();
    if (hasLocale(routing.locales, paramValue)) {
      locale = paramValue;
    } else {
      notFound();
    }
  }

  return {
    locale,
    messages: (await import(`../../messages/${locale}.json`)).default,
  };
});
