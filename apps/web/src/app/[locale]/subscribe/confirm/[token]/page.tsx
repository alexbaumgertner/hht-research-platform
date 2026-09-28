import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { Stack, Text, Title } from '@mantine/core';
import { getPayload } from 'payload';
import config from '@payload-config';

import { TextLink } from '@/components/TextLink';
import { incrementAnalyticsCount } from '@/lib/analyticsCounts';
import { routing } from '@/i18n/routing';
import { sendWelcomeIssue } from '@/lib/subscriberMail';
import { hashSubscriptionToken, unsubscribeTokenFor } from '@/lib/subscriptionTokens';

type Props = { params: Promise<{ locale: string; token: string }> };

const LOCALES = new Set<string>(routing.locales);

function confirmationStillValid(expiresAt: string | null | undefined): boolean {
  if (!expiresAt) return false;
  return new Date(expiresAt).getTime() > Date.now();
}

export default async function ConfirmSubscriptionPage({ params }: Props) {
  const { locale, token } = await params;
  if (!LOCALES.has(locale)) notFound();

  const payload = await getPayload({ config });
  const hash = hashSubscriptionToken(token);
  const found = await payload.find({
    collection: 'subscribers',
    where: {
      and: [{ confirmationTokenHash: { equals: hash } }, { status: { equals: 'pending' } }],
    },
    limit: 1,
    depth: 1,
    overrideAccess: true,
  });
  const row = found.docs[0];
  const valid = Boolean(row) && confirmationStillValid(row?.confirmationExpiresAt);

  if (!valid || !row) {
    const t = await getTranslations({ locale, namespace: 'Confirm' });
    return (
      <Stack gap="md" maw={720} mx="auto" w="100%">
        <Title order={1}>{t('invalidTitle')}</Title>
        <Text>{t('invalid')}</Text>
      </Stack>
    );
  }

  const secret = process.env.PAYLOAD_SECRET ?? '';
  const unsub = unsubscribeTokenFor(row.id, secret);
  await payload.update({
    collection: 'subscribers',
    id: row.id,
    data: {
      status: 'confirmed',
      confirmationTokenHash: null,
      confirmationExpiresAt: null,
      unsubscribeTokenHash: unsub.hash,
    },
    overrideAccess: true,
  });

  const project =
    row.project && typeof row.project === 'object'
      ? row.project
      : await payload.findByID({
          collection: 'research-projects',
          id: row.project as number,
          depth: 1,
          overrideAccess: true,
        });
  const projectId = project.id;
  const projectSlug = typeof project === 'object' ? String(project.slug) : '';
  const projectName = typeof project === 'object' ? String(project.name) : '';
  const senderName =
    typeof project === 'object' ? project.emailFromName?.trim() || projectName : projectName;
  const owner =
    typeof project === 'object' && project.owner && typeof project.owner === 'object'
      ? String(project.owner.email ?? '')
      : '';

  await incrementAnalyticsCount({
    projectId,
    issueKey: 'none',
    source: row.source,
    metric: 'confirmation',
  });

  const language = row.language === 'ru' ? 'ru' : 'en';
  try {
    await sendWelcomeIssue({
      subscriberId: row.id,
      email: row.email,
      language,
      projectId,
      projectSlug,
      projectName,
      senderName,
      replyTo: owner || null,
      source: row.source ?? 'other',
    });
  } catch {
    // The subscription is confirmed. The sweep retries a pending welcome row.
  }

  const latest = await payload.find({
    collection: 'digests',
    where: {
      and: [{ project: { equals: projectId } }, { hiddenFromPublic: { not_equals: true } }],
    },
    sort: '-publishedAt',
    limit: 1,
    depth: 0,
    overrideAccess: true,
  });
  const issueId = latest.docs[0]?.id;

  const t = await getTranslations({ locale: language, namespace: 'Confirm' });
  return (
    <Stack gap="md" maw={720} mx="auto" w="100%">
      <Title order={1}>{t('successTitle')}</Title>
      <Text>{t('success')}</Text>
      {issueId && projectSlug ? (
        <TextLink href={`/projects/${projectSlug}/issues/${issueId}`}>{t('latestIssue')}</TextLink>
      ) : null}
    </Stack>
  );
}
