import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { Stack, Text, Title } from '@mantine/core';

import { TextLink } from '@/components/TextLink';
import { routing } from '@/i18n/routing';

type Props = { params: Promise<{ locale: string }> };

const LOCALES = new Set<string>(routing.locales);

export default async function PrivacyPage({ params }: Props) {
  const { locale } = await params;
  if (!LOCALES.has(locale)) notFound();

  const chrome = await getTranslations({ locale, namespace: 'Privacy' });
  const bodyLocale = locale === 'ru' || locale === 'en' ? locale : 'en';
  const body = await getTranslations({ locale: bodyLocale, namespace: 'Privacy' });

  return (
    <Stack gap="md" maw={720} mx="auto" w="100%">
      <TextLink href="/" size="sm">
        {chrome('back')}
      </TextLink>
      <Title order={1}>{chrome('title')}</Title>
      <Text>{body('controller')}</Text>
      <Text>{body('lawfulBasis')}</Text>
      <Text>{body('stored')}</Text>
      <Text>{body('storage')}</Text>
      <Text>{body('retention')}</Text>
      <Text>{body('clickFlag')}</Text>
      <Text>{body('unsubscribe')}</Text>
      <Text>{body('deletion')}</Text>
      <Text>{body('sourceCookie')}</Text>
      <Text>{body('rateLimit')}</Text>
    </Stack>
  );
}
