import { Stack, Text } from '@mantine/core';
import { getTranslations } from 'next-intl/server';

export async function TrustNotice() {
  const t = await getTranslations('Trust');

  return (
    <Stack gap="xs" component="aside">
      <Text size="sm" c="dimmed">
        {t('disclaimer')}
      </Text>
      <Text size="sm" c="dimmed">
        {t('aiLabel')}
      </Text>
    </Stack>
  );
}
