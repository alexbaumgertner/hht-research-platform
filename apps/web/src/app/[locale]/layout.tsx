import { NextIntlClientProvider } from 'next-intl';
import { getLocale, getMessages } from 'next-intl/server';
import { Container, Group, Stack, Title, mantineHtmlProps } from '@mantine/core';
import { IBM_Plex_Sans } from 'next/font/google';

import { Providers } from '../providers';
import { LocaleSwitcher } from '@/components/LocaleSwitcher';
import { MantineColorSchemeInit } from '@/components/MantineColorSchemeInit';
import { routing } from '@/i18n/routing';

const ibmPlexSans = IBM_Plex_Sans({
  subsets: ['latin', 'cyrillic'],
  weight: ['400', '500', '600', '700'],
  display: 'swap',
});

type Props = {
  children: React.ReactNode;
};

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export default async function LocaleLayout({ children }: Props) {
  const locale = await getLocale();
  const messages = await getMessages();

  return (
    <html lang={locale} className={ibmPlexSans.className} {...mantineHtmlProps}>
      <body style={{ margin: 0, minHeight: '100vh', background: 'var(--mantine-color-body)' }}>
        <MantineColorSchemeInit />
        <Providers>
          <NextIntlClientProvider messages={messages}>
            <Container size="md" py="xl">
              <Stack gap="lg">
                <Group justify="space-between" align="flex-end" wrap="wrap">
                  <Title order={3}>Research Monitoring</Title>
                  <LocaleSwitcher />
                </Group>
                {children}
              </Stack>
            </Container>
          </NextIntlClientProvider>
        </Providers>
      </body>
    </html>
  );
}
