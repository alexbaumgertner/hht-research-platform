import { getRequestConfig } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { PUBLIC_LOCALES, type Locale } from '@hht/shared';

export const locales = PUBLIC_LOCALES;
export const defaultLocale: Locale = 'en';

export default getRequestConfig(async ({ requestLocale }) => {
  const locale = await requestLocale;
  if (!locale || !locales.includes(locale as Locale)) {
    notFound();
  }

  return {
    locale,
    messages: (await import(`../../messages/${locale}.json`)).default,
  };
});
