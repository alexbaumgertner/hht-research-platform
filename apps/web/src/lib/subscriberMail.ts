import {
  buildIssueEmail,
  normalizeSubscriberEmail,
  type EmailLanguage,
  type IssueEmailContent,
  type IssueEmailItem,
} from '@hht/shared';
import { getPayload, type Payload } from 'payload';
import config from '@payload-config';

import { sendEmail } from '@/lib/email';
import {
  sortIssuePublications,
  type IssueDigestDoc,
  type IssuePublicationDoc,
} from '@/lib/issueQueries';
import { relationId } from '@/lib/issueTypes';
import { getPublicSiteUrl } from '@/lib/siteUrl';
import {
  clickTokenFor,
  createSubscriptionToken,
  hashSubscriptionToken,
  unsubscribeTokenFor,
} from '@/lib/subscriptionTokens';

const WELCOME_MAX_AGE_MS = 14 * 24 * 60 * 60 * 1000;
const CONFIRM_TTL_MS = 7 * 24 * 60 * 60 * 1000;

type SummaryPointRef = { text: string };

const SOURCE_LABEL: Record<string, string> = {
  pubmed: 'PubMed',
  clinicaltrials: 'Clinical trials',
  news: 'News',
  guideline: 'Guideline',
  social: 'Social',
  unknown: 'Source',
};

export function subscriberMailEnabled(
  env: Record<string, string | undefined> = process.env,
): boolean {
  const key = env.RESEND_API_KEY?.trim() ?? '';
  const from = env.RESEND_FROM_EMAIL?.trim() ?? '';
  return key.length > 0 && from.length > 0 && !from.toLowerCase().endsWith('@resend.dev');
}

export function isSandboxFromAddress(
  env: Record<string, string | undefined> = process.env,
): boolean {
  const from = env.RESEND_FROM_EMAIL?.trim() ?? '';
  return from.toLowerCase().endsWith('@resend.dev');
}

const CONFIRM_COPY: Record<
  EmailLanguage,
  { subject: (project: string) => string; sentence: string; privacy: string }
> = {
  en: {
    subject: (project) => `Confirm your email for ${project}`,
    sentence: 'Please confirm that you want email updates.',
    privacy: 'Privacy',
  },
  ru: {
    subject: (project) => `Подтвердите почту для ${project}`,
    sentence: 'Подтвердите, что хотите получать обновления по почте.',
    privacy: 'Конфиденциальность',
  },
};

export function confirmationExpiry(from = new Date()): string {
  return new Date(from.getTime() + CONFIRM_TTL_MS).toISOString();
}

export function issueListUnsubscribeHeaders(token: string): Record<string, string> {
  const url = `${getPublicSiteUrl()}/api/unsubscribe/${encodeURIComponent(token)}`;
  return {
    'List-Unsubscribe': `<${url}>`,
    'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
  };
}

export async function sendConfirmationEmail(input: {
  to: string;
  language: EmailLanguage;
  projectName: string;
  replyTo: string | null;
  subscriberId: string | number;
  token: string;
  tokenHash: string;
}): Promise<{ id: string }> {
  const copy = CONFIRM_COPY[input.language];
  const confirmUrl = `${getPublicSiteUrl()}/${input.language}/subscribe/confirm/${input.token}`;
  const privacyUrl = `${getPublicSiteUrl()}/${input.language}/privacy`;
  const text = [
    input.projectName,
    '',
    copy.sentence,
    confirmUrl,
    '',
    `${copy.privacy}: ${privacyUrl}`,
  ].join('\n');
  return sendEmail({
    to: input.to,
    subject: copy.subject(input.projectName),
    text,
    html: `<p>${escapeHtml(input.projectName)}</p><p>${escapeHtml(copy.sentence)}</p><p><a href="${escapeHtml(confirmUrl)}">${escapeHtml(confirmUrl)}</a></p><p><a href="${escapeHtml(privacyUrl)}">${escapeHtml(copy.privacy)}</a></p>`,
    replyTo: input.replyTo ?? undefined,
    fromName: input.projectName,
    idempotencyKey: `confirm/${input.subscriberId}/${input.tokenHash.slice(0, 12)}`,
  });
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

function formatDate(value: string | null | undefined, language: EmailLanguage): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString(language === 'ru' ? 'ru' : 'en', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

export function issueContentFromDocs(
  digest: IssueDigestDoc,
  publications: IssuePublicationDoc[],
  language: EmailLanguage,
  sentences: Map<string, string>,
): IssueEmailContent {
  const ordered = sortIssuePublications(publications);
  const points = (digest.issueSummaryPoints ?? []).flatMap((point) =>
    point.text ? [point.text] : [],
  );
  const items: IssueEmailItem[] = ordered.map((publication) => ({
    title: publication.title?.trim() || 'Untitled',
    source: SOURCE_LABEL[publication.sourceType ?? ''] ?? 'Source',
    date: formatDate(publication.publishedOrUpdatedAt, language),
    sentence: sentences.get(String(publication.id)) ?? '',
    isTrial: publication.sourceType === 'clinicaltrials',
  }));
  return {
    date: formatDate(digest.publishedAt, language) ?? digest.publishedAt,
    summaryPoints: points,
    items,
  };
}

async function payloadClient(): Promise<Payload> {
  return getPayload({ config });
}

export async function sendWelcomeIssue(input: {
  subscriberId: string | number;
  email: string;
  language: EmailLanguage;
  projectId: string | number;
  projectSlug: string;
  projectName: string;
  senderName: string;
  replyTo: string | null;
  source: string;
}): Promise<void> {
  const payload = await payloadClient();
  const secret = process.env.PAYLOAD_SECRET ?? '';
  const issues = await payload.find({
    collection: 'digests',
    where: {
      and: [
        { project: { equals: input.projectId } },
        { hiddenFromPublic: { not_equals: true } },
        { issueTextStatus: { equals: 'ready' } },
      ],
    },
    sort: '-publishedAt',
    limit: 1,
    depth: 0,
    overrideAccess: true,
  });
  const digest = issues.docs[0];
  if (!digest?.publishedAt) return;
  const publishedAt = new Date(digest.publishedAt);
  if (Number.isNaN(publishedAt.getTime())) return;
  if (Date.now() - publishedAt.getTime() > WELCOME_MAX_AGE_MS) return;

  let bodyLanguage: EmailLanguage = 'en';
  const russianFallback = false;
  let sendNow = input.language === 'en';
  if (input.language === 'ru') {
    const translations = await payload.find({
      collection: 'issue-translations',
      where: {
        and: [{ digest: { equals: digest.id } }, { locale: { equals: 'ru' } }],
      },
      limit: 1,
      depth: 0,
      overrideAccess: true,
    });
    if (translations.docs[0]?.status === 'ready') {
      bodyLanguage = 'ru';
      sendNow = true;
    }
  }

  const click = clickTokenFor(digest.id, input.subscriberId, secret);
  const unsub = unsubscribeTokenFor(input.subscriberId, secret);
  let deliveryId: string | number;
  try {
    const created = await payload.create({
      collection: 'issue-deliveries',
      data: {
        project: Number(input.projectId),
        digest: Number(digest.id),
        subscriber: Number(input.subscriberId),
        status: 'pending',
        attempts: 0,
        clickTokenHash: click.hash,
      },
      overrideAccess: true,
    });
    deliveryId = created.id;
  } catch {
    return;
  }
  if (!sendNow) return;

  const pubs = await payload.find({
    collection: 'publications',
    where: {
      id: {
        in: ((digest.publications ?? []) as unknown[])
          .map((item) => relationId(item))
          .filter(Boolean),
      },
    },
    depth: 1,
    limit: 100,
    overrideAccess: true,
  });
  const publications = pubs.docs as unknown as IssuePublicationDoc[];
  const sentences = new Map<string, string>();
  if (bodyLanguage === 'ru') {
    const translations = await payload.find({
      collection: 'issue-translations',
      where: { and: [{ digest: { equals: digest.id } }, { locale: { equals: 'ru' } }] },
      limit: 1,
      depth: 0,
      overrideAccess: true,
    });
    const row = translations.docs[0];
    for (const sentence of row?.itemSentences ?? []) {
      const id = relationId(sentence.publication);
      if (id && sentence.sentence) sentences.set(id, sentence.sentence);
    }
  } else {
    for (const sentence of digest.issueItemSentences ?? []) {
      const id = relationId(sentence.publication);
      if (id && sentence.sentence) sentences.set(id, sentence.sentence);
    }
  }

  const summaryPointRows: SummaryPointRef[] =
    bodyLanguage === 'ru'
      ? (((
          await payload.find({
            collection: 'issue-translations',
            where: { and: [{ digest: { equals: digest.id } }, { locale: { equals: 'ru' } }] },
            limit: 1,
            depth: 0,
            overrideAccess: true,
          })
        ).docs[0]?.summaryPoints ?? []) as SummaryPointRef[])
      : ((digest.issueSummaryPoints ?? []) as SummaryPointRef[]);
  const summaryPoints = summaryPointRows.map((point) => point.text);

  const content = issueContentFromDocs(
    {
      id: digest.id,
      publishedAt: digest.publishedAt,
      hiddenFromPublic: false,
      issueTextStatus: 'ready',
      issueTextRevision: digest.issueTextRevision ?? null,
      issueSummaryPoints: summaryPoints.map((text) => ({ text, items: [] })),
      issueItemSentences: null,
      publications: digest.publications,
    },
    publications,
    bodyLanguage,
    sentences,
  );
  content.summaryPoints = summaryPoints;

  const site = getPublicSiteUrl();
  const email = buildIssueEmail({
    issue: content,
    language: bodyLanguage,
    senderName: input.senderName,
    links: {
      issue: `${site}/r/${click.token}/issue`,
      privacy: `${site}/r/${click.token}/privacy`,
      unsubscribe: `${site}/${input.language}/unsubscribe/${unsub.token}`,
    },
    russianFallback,
  });

  try {
    const sent = await sendEmail({
      to: input.email,
      subject: email.subject,
      text: email.text,
      html: email.html,
      replyTo: input.replyTo ?? undefined,
      fromName: input.senderName,
      headers: issueListUnsubscribeHeaders(unsub.token),
      idempotencyKey: `issue/${digest.id}/subscriber/${input.subscriberId}`,
    });
    await payload.update({
      collection: 'issue-deliveries',
      id: deliveryId,
      data: { status: 'sent', sentAt: new Date().toISOString(), resendEmailId: sent.id },
      overrideAccess: true,
    });
  } catch {
    return;
  }
}

export function newConfirmationToken(now = new Date()) {
  const created = createSubscriptionToken();
  return {
    ...created,
    confirmationExpiresAt: confirmationExpiry(now),
    confirmationSentAt: now.toISOString(),
  };
}

export function hashesMatch(token: string, stored: string | null | undefined): boolean {
  if (!stored) return false;
  return hashSubscriptionToken(token) === stored;
}

export function sameAddress(a: string, b: string): boolean {
  return normalizeSubscriberEmail(a) === normalizeSubscriberEmail(b);
}
