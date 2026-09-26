import { notFound, redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { Stack, Text, Title } from '@mantine/core';
import { getPayload } from 'payload';
import config from '@payload-config';

import { routing } from '@/i18n/routing';
import { hashSubscriptionToken } from '@/lib/subscriptionTokens';

type Props = {
  params: Promise<{ locale: string; token: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

const LOCALES = new Set<string>(routing.locales);

async function findByToken(token: string) {
  const payload = await getPayload({ config });
  const hash = hashSubscriptionToken(token);
  const found = await payload.find({
    collection: 'subscribers',
    where: { unsubscribeTokenHash: { equals: hash } },
    limit: 1,
    depth: 0,
    overrideAccess: true,
  });
  return { payload, row: found.docs[0] ?? null };
}

async function unsubscribeAction(formData: FormData) {
  'use server';
  const token = String(formData.get('token') ?? '');
  const locale = String(formData.get('locale') ?? 'en');
  const { payload, row } = await findByToken(token);
  if (row?.status === 'confirmed') {
    await payload.update({
      collection: 'subscribers',
      id: row.id,
      data: { status: 'unsubscribed', unsubscribedAt: new Date().toISOString() },
      overrideAccess: true,
    });
    const language = row.language === 'ru' ? 'ru' : 'en';
    redirect(`/${language}/unsubscribe/${token}?done=1`);
  }
  redirect(`/${LOCALES.has(locale) ? locale : 'en'}/unsubscribe/${token}`);
}

export default async function UnsubscribePage({ params, searchParams }: Props) {
  const { locale, token } = await params;
  if (!LOCALES.has(locale)) notFound();
  const query = await searchParams;
  const done = query.done === '1';
  const { row } = await findByToken(token);

  if (done && row?.status === 'unsubscribed') {
    const language = row.language === 'ru' ? 'ru' : locale;
    const t = await getTranslations({ locale: language, namespace: 'Unsubscribe' });
    return (
      <Stack gap="md" maw={720} mx="auto" w="100%">
        <Title order={1}>{t('doneTitle')}</Title>
        <Text>{t('done')}</Text>
      </Stack>
    );
  }

  if (row?.status === 'confirmed') {
    const t = await getTranslations({ locale, namespace: 'Unsubscribe' });
    return (
      <Stack gap="md" maw={720} mx="auto" w="100%">
        <Title order={1}>{t('title')}</Title>
        <Text>{t('prompt')}</Text>
        <form action={unsubscribeAction}>
          <input type="hidden" name="token" value={token} />
          <input type="hidden" name="locale" value={locale} />
          <button type="submit">{t('button')}</button>
        </form>
      </Stack>
    );
  }

  const t = await getTranslations({ locale, namespace: 'Unsubscribe' });
  return (
    <Stack gap="md" maw={720} mx="auto" w="100%">
      <Title order={1}>{t('notSubscribedTitle')}</Title>
      <Text>{t('notSubscribed')}</Text>
    </Stack>
  );
}
