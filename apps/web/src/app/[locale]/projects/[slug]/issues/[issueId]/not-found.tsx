'use client';

import { Stack, Text } from '@mantine/core';
import { useTranslations } from 'next-intl';
import { usePathname } from '@/i18n/navigation';

import { TextLink } from '@/components/TextLink';

function projectHrefFromPathname(pathname: string): string {
  const match = pathname.match(/\/projects\/([^/]+)/);
  return match ? `/projects/${match[1]}` : '/';
}

export default function IssueNotFound() {
  const t = useTranslations('Issue');
  const pathname = usePathname();

  return (
    <Stack gap="md" maw={720} mx="auto" w="100%">
      <Text>{t('notFound')}</Text>
      <TextLink href={projectHrefFromPathname(pathname)} size="sm">
        {t('backToProject')}
      </TextLink>
    </Stack>
  );
}
