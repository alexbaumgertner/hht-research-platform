'use client';

import { Button, Stack, Text } from '@mantine/core';
import { useTranslations } from 'next-intl';
import { usePathname } from '@/i18n/navigation';

import { TextLink } from '@/components/TextLink';

type Props = {
  error: Error & { digest?: string };
  reset: () => void;
};

function projectHrefFromPathname(pathname: string): string {
  const match = pathname.match(/\/projects\/([^/]+)/);
  return match ? `/projects/${match[1]}` : '/';
}

export default function IssueLoadError({ reset }: Props) {
  const t = useTranslations('Issue');
  const pathname = usePathname();

  return (
    <Stack gap="md" maw={720} mx="auto" w="100%" role="alert">
      <Text>{t('loadError')}</Text>
      <Button variant="light" onClick={reset} w="fit-content">
        {t('retry')}
      </Button>
      <TextLink href={projectHrefFromPathname(pathname)} size="sm">
        {t('backToProject')}
      </TextLink>
    </Stack>
  );
}
