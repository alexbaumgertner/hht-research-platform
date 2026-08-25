import { NextIntlClientProvider } from 'next-intl';
import { getMessages, setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { Container, Group, Stack, Title } from '@mantine/core';
import { IBM_Plex_Sans } from 'next/font/google';
import { PUBLIC_LOCALES, type Locale } from '@hht/shared';

import { Providers } from '../providers';
import { LocaleSwitcher } from '@/components/LocaleSwitcher';

const ibmPlexSans = IBM_Plex_Sans({
  subsets: ['latin', 'cyrillic'],
  weight: ['400', '500', '600', '700'],
  display: 'swap',
});

type Props = {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
};

export function generateStaticParams() {
  return PUBLIC_LOCALES.map((locale) => ({ locale }));
}

export default async function LocaleLayout({ children, params }: Props) {
  const { locale } = await params;
  if (!PUBLIC_LOCALES.includes(locale as Locale)) {
    notFound();
  }

  setRequestLocale(locale);
  const messages = await getMessages();

  return (
    <html lang={locale} className={ibmPlexSans.className}>
      <body style={{ margin: 0, minHeight: '100vh', background: '#f6f8f7' }}>
        <Providers>
          <NextIntlClientProvider messages={messages}>
            <Container size="md" py="xl">
              <Stack gap="lg">
                <Group justify="space-between" align="flex-end">
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
