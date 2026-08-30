import { NextIntlClientProvider } from 'next-intl';
import { getMessages, setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import Script from 'next/script';
import { Container, Group, Stack, Title, mantineHtmlProps } from '@mantine/core';
import { IBM_Plex_Sans } from 'next/font/google';
import { PUBLIC_LOCALES, type Locale } from '@hht/shared';

import { Providers } from '../providers';
import { LocaleSwitcher } from '@/components/LocaleSwitcher';

const ibmPlexSans = IBM_Plex_Sans({
  subsets: ['latin', 'cyrillic'],
  weight: ['400', '500', '600', '700'],
  display: 'swap',
});

/** Same logic as Mantine ColorSchemeScript — via next/script to avoid Next 16 client <script> warning. */
const MANTINE_COLOR_SCHEME_SCRIPT = `try {
  var _colorScheme = window.localStorage.getItem("mantine-color-scheme-value");
  var colorScheme = _colorScheme === "light" || _colorScheme === "dark" || _colorScheme === "auto" ? _colorScheme : "auto";
  var computedColorScheme = colorScheme !== "auto" ? colorScheme : window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  document.documentElement.setAttribute("data-mantine-color-scheme", computedColorScheme);
} catch (e) {}`;

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
    <html lang={locale} className={ibmPlexSans.className} {...mantineHtmlProps}>
      <head>
        <Script
          id="mantine-color-scheme"
          strategy="beforeInteractive"
          dangerouslySetInnerHTML={{ __html: MANTINE_COLOR_SCHEME_SCRIPT }}
        />
      </head>
      <body style={{ margin: 0, minHeight: '100vh', background: 'var(--mantine-color-body)' }}>
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
