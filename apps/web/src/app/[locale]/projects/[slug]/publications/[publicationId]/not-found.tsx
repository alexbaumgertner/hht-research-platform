'use client';

import { Stack, Text } from '@mantine/core';
import { useTranslations } from 'next-intl';
import { usePathname } from '@/i18n/navigation';

import { TextLink } from '@/components/TextLink';

function feedHrefFromPathname(pathname: string): string {
  const match = pathname.match(/\/projects\/([^/]+)/);
  return match ? `/projects/${match[1]}` : '/';
}

export default function MaterialNotFound() {
  const t = useTranslations('Publication');
  const pathname = usePathname();

  return (
    <Stack gap="md" maw={720} mx="auto" w="100%">
      <Text>{t('notFound')}</Text>
      <TextLink href={feedHrefFromPathname(pathname)} size="sm">
        {t('backToFeed')}
      </TextLink>
    </Stack>
  );
}
