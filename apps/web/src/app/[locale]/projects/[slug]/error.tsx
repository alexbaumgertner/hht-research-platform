'use client';

import { Button, Stack, Text } from '@mantine/core';
import { useTranslations } from 'next-intl';

type Props = {
  error: Error & { digest?: string };
  reset: () => void;
};

export default function ProjectFeedError({ reset }: Props) {
  const t = useTranslations('Materials');

  return (
    <Stack gap="md" role="alert">
      <Text>{t('loadError')}</Text>
      <Button variant="light" onClick={reset} w="fit-content">
        {t('retry')}
      </Button>
    </Stack>
  );
}
