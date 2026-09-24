'use client';

import { Stack, Text } from '@mantine/core';
import { useTranslations } from 'next-intl';

import { TextLink } from '@/components/TextLink';

export default function ProjectNotFound() {
  const t = useTranslations('Project');

  return (
    <Stack gap="md" maw={720} mx="auto" w="100%">
      <Text>{t('notFound')}</Text>
      <TextLink href="/" size="sm">
        {t('backHome')}
      </TextLink>
    </Stack>
  );
}
