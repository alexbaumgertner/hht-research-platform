import {
  applyDeliveryFailure,
  buildChatPosts,
  buildIssueEmail,
  clickTokenFor,
  decideLanguageSend,
  formatOwnerKit,
  statusAfterHide,
  unsubscribeTokenFor,
  type ChatIssueText,
  type EmailLanguage,
} from '@hht/shared';

import { logError, logWarning } from '../log.js';

export type SweepId = string | number;

export type SweepDigest = {
  id: SweepId;
  projectId: SweepId;
  slug: string;
  projectName: string;
  senderName: string;
  ownerEmail: string | null;
  publishedAt: string;
  hiddenFromPublic: boolean;
  issueTextStatus: 'pending' | 'ready' | 'failed' | null;
  subscriberFanoutAt: string | null;
  subscriberSendBlockedAt: string | null;
  ownerKitSentAt: string | null;
  vkCommunityId: string | null;
  english: ChatIssueText;
  russian: ChatIssueText | null;
};

export type SweepSubscriber = {
  id: SweepId;
  projectId: SweepId;
  email: string;
  language: EmailLanguage;
  status: 'pending' | 'confirmed' | 'unsubscribed';
  source: string;
  confirmationExpiresAt: string | null;
  unsubscribedAt: string | null;
};

export type SweepDelivery = {
  id: SweepId;
  digestId: SweepId;
  subscriberId: SweepId;
  status: 'pending' | 'sent' | 'failed' | 'skipped';
  attempts: number;
  nextAttemptAt: string | null;
  language: EmailLanguage;
  email: string;
};

export type SweepVkPost = {
  id: SweepId;
  digestId: SweepId;
  projectId: SweepId;
  vkCommunityId: string;
  status: 'pending' | 'published' | 'failed' | 'skipped';
  vkPostId: string | null;
};

export type MailSendResult =
  { ok: true; id: string } | { ok: false; status: number; code?: string };

export type SubscriptionCms = {
  listDigests(): Promise<SweepDigest[]>;
  getDigest(id: SweepId): Promise<SweepDigest>;
  patchDigest(id: SweepId, data: Partial<SweepDigest>): Promise<void>;
  listConfirmedSubscribers(projectId: SweepId): Promise<SweepSubscriber[]>;
  listDeliveries(digestId: SweepId): Promise<SweepDelivery[]>;
  insertDelivery(input: {
    digestId: SweepId;
    subscriberId: SweepId;
    clickTokenHash: string;
  }): Promise<SweepDelivery | 'conflict'>;
  patchDelivery(
    id: SweepId,
    data: Partial<SweepDelivery> & {
      lastError?: string | null;
      resendEmailId?: string;
      sentAt?: string;
    },
  ): Promise<void>;
  listVkPosts(digestId: SweepId): Promise<SweepVkPost[]>;
  insertVkPost(input: { digest: SweepDigest }): Promise<SweepVkPost | 'conflict' | 'skip'>;
  patchVkPost(
    id: SweepId,
    data: Partial<SweepVkPost> & { lastError?: string | null },
  ): Promise<void>;
  translate(digestId: SweepId): Promise<'ready' | 'unavailable' | 'failed'>;
  deleteExpired(now: Date): Promise<void>;
};

export type SubscriptionSweepDeps = {
  cms: SubscriptionCms;
  now?: () => Date;
  send?: (message: {
    to: string;
    subject: string;
    text: string;
    html: string;
    idempotencyKey: string;
    headers?: Record<string, string>;
    fromName: string;
    replyTo?: string;
  }) => Promise<MailSendResult>;
  postVk?: (body: URLSearchParams) => Promise<{ postId: string }>;
  sleep?: (ms: number) => Promise<void>;
  env?: Record<string, string | undefined>;
  logError?: typeof logError;
  logWarning?: typeof logWarning;
};

function mailEnabled(env: Record<string, string | undefined>): boolean {
  const key = env.RESEND_API_KEY?.trim() ?? '';
  const from = env.RESEND_FROM_EMAIL?.trim() ?? '';
  return key.length > 0 && from.length > 0 && !from.toLowerCase().endsWith('@resend.dev');
}

function sameEmail(a: string, b: string): boolean {
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}

async function sendWithRateLimit(
  send: NonNullable<SubscriptionSweepDeps['send']>,
  sleep: (ms: number) => Promise<void>,
  message: Parameters<NonNullable<SubscriptionSweepDeps['send']>>[0],
): Promise<MailSendResult> {
  const first = await send(message);
  if (first.ok || first.status !== 429 || first.code !== 'rate_limit_exceeded') return first;
  await sleep(1000);
  return send(message);
}

function failureKind(
  result: Extract<MailSendResult, { ok: false }>,
): 'quota' | 'transient' | 'permanent' {
  if (
    result.status === 429 &&
    (result.code === 'daily_quota_exceeded' || result.code === 'monthly_quota_exceeded')
  ) {
    return 'quota';
  }
  if (result.status >= 500 || result.status === 0) return 'transient';
  return 'permanent';
}

async function defaultSend(
  message: Parameters<NonNullable<SubscriptionSweepDeps['send']>>[0],
  env: Record<string, string | undefined>,
): Promise<MailSendResult> {
  if (env.EMAIL_DELIVERY === 'stub' && env.VERCEL_ENV !== 'production') {
    return { ok: true, id: `stub_${message.idempotencyKey}` };
  }
  const apiKey = env.RESEND_API_KEY?.trim();
  if (!apiKey) return { ok: false, status: 0, code: 'missing_api_key' };
  const fromAddress = env.RESEND_FROM_EMAIL?.trim() || 'onboarding@resend.dev';
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'Idempotency-Key': message.idempotencyKey,
    },
    body: JSON.stringify({
      from: `${message.fromName} <${fromAddress}>`,
      to: message.to,
      subject: message.subject,
      text: message.text,
      html: message.html,
      ...(message.replyTo ? { reply_to: message.replyTo } : {}),
      ...(message.headers ? { headers: message.headers } : {}),
    }),
  });
  const body = await res.text();
  if (!res.ok) {
    let code: string | undefined;
    try {
      code = (JSON.parse(body) as { name?: string }).name;
    } catch {
      code = undefined;
    }
    return { ok: false, status: res.status, code };
  }
  try {
    return { ok: true, id: (JSON.parse(body) as { id?: string }).id ?? '' };
  } catch {
    return { ok: true, id: '' };
  }
}

async function defaultPostVk(body: URLSearchParams): Promise<{ postId: string }> {
  const res = await fetch('https://api.vk.com/method/wall.post', { method: 'POST', body });
  const json = (await res.json()) as {
    error?: { error_msg?: string };
    response?: { post_id?: number };
  };
  if (!res.ok || json.error || json.response?.post_id == null) {
    throw new Error(json.error?.error_msg || 'VK wall.post failed');
  }
  return { postId: String(json.response.post_id) };
}

export async function sweepSubscriptions(deps: SubscriptionSweepDeps): Promise<void> {
  const now = (deps.now ?? (() => new Date()))();
  const env = deps.env ?? process.env;
  const cms = deps.cms;
  const send = deps.send ?? ((message) => defaultSend(message, env));
  const postVk = deps.postVk ?? defaultPostVk;
  const sleep = deps.sleep ?? ((ms) => new Promise((resolve) => setTimeout(resolve, ms)));
  const reportError = deps.logError ?? logError;
  const reportWarning = deps.logWarning ?? logWarning;
  const secret = env.PAYLOAD_SECRET?.trim() ?? '';
  if (!secret) {
    // Links must match the ones the web app derives with the same secret.
    reportError('subscription sweep skipped: PAYLOAD_SECRET is not set');
    return;
  }
  const site = (env.PUBLIC_SITE_URL ?? '').replace(/\/$/, '');
  const gateOpen = mailEnabled(env);
  let sandboxWarned = false;
  const fallbackLogged = new Set<string>();

  const digests = await cms.listDigests();
  for (const digest of digests) {
    if (digest.issueTextStatus === 'failed' && !digest.subscriberFanoutAt) {
      if (!digest.subscriberSendBlockedAt) {
        await cms.patchDigest(digest.id, { subscriberSendBlockedAt: now.toISOString() });
        reportError('subscriber send blocked because issue text failed', undefined, {
          digestId: digest.id,
        });
      }
      continue;
    }

    const eligible =
      digest.issueTextStatus === 'ready' &&
      !digest.hiddenFromPublic &&
      !digest.subscriberFanoutAt &&
      !digest.subscriberSendBlockedAt;
    if (!eligible) continue;

    const confirmed = await cms.listConfirmedSubscribers(digest.projectId);
    const owner = digest.ownerEmail;
    const recipients = gateOpen
      ? confirmed
      : confirmed.filter((subscriber) => owner && sameEmail(subscriber.email, owner));
    if (!gateOpen && confirmed.length > recipients.length && !sandboxWarned) {
      reportWarning('sandbox from-address; mailing the owner only');
      sandboxWarned = true;
    }

    for (const subscriber of recipients) {
      const existing = (await cms.listDeliveries(digest.id)).some(
        (row) => String(row.subscriberId) === String(subscriber.id),
      );
      if (existing) continue;
      const click = clickTokenFor(digest.id, subscriber.id, secret);
      await cms.insertDelivery({
        digestId: digest.id,
        subscriberId: subscriber.id,
        clickTokenHash: click.hash,
      });
    }

    const vkToken = env.VK_COMMUNITY_TOKEN?.trim();
    if (digest.vkCommunityId && vkToken) {
      await cms.insertVkPost({ digest });
    }

    if (gateOpen || recipients.length === confirmed.length) {
      await cms.patchDigest(digest.id, { subscriberFanoutAt: now.toISOString() });
    }
  }

  for (const digest of await cms.listDigests()) {
    if (digest.hiddenFromPublic) {
      for (const delivery of await cms.listDeliveries(digest.id)) {
        if (delivery.status === 'pending') {
          await cms.patchDelivery(delivery.id, { status: statusAfterHide(delivery.status) });
        }
      }
      for (const post of await cms.listVkPosts(digest.id)) {
        if (post.status === 'pending' && !post.vkPostId) {
          await cms.patchVkPost(post.id, { status: 'skipped' });
        }
      }
      continue;
    }

    let russianReady = Boolean((await cms.getDigest(digest.id)).russian);
    const pendingRussian = (await cms.listDeliveries(digest.id)).some(
      (row) => row.status === 'pending' && row.language === 'ru',
    );
    const pendingVk = (await cms.listVkPosts(digest.id)).some((row) => row.status === 'pending');
    if ((pendingRussian || pendingVk) && !russianReady) {
      await cms.translate(digest.id);
      russianReady = Boolean((await cms.getDigest(digest.id)).russian);
    }

    if (send) {
      for (const delivery of await cms.listDeliveries(digest.id)) {
        const fresh = await cms.getDigest(digest.id);
        if (fresh.hiddenFromPublic) {
          if (delivery.status === 'pending') {
            await cms.patchDelivery(delivery.id, { status: 'skipped' });
          }
          continue;
        }
        if (delivery.status !== 'pending') continue;
        if (delivery.nextAttemptAt && new Date(delivery.nextAttemptAt).getTime() > now.getTime())
          continue;

        const decision = decideLanguageSend({
          language: delivery.language,
          russianReady,
          publishedAt: new Date(fresh.publishedAt),
          now,
        });
        if (decision.action === 'wait') continue;

        const click = clickTokenFor(fresh.id, delivery.subscriberId, secret);
        const unsub = unsubscribeTokenFor(delivery.subscriberId, secret);
        const body =
          decision.bodyLanguage === 'ru' && fresh.russian ? fresh.russian : fresh.english;
        const email = buildIssueEmail({
          issue: {
            date: fresh.publishedAt,
            summaryPoints: body.summaryPoints,
            items: body.items,
          },
          language: decision.bodyLanguage,
          senderName: fresh.senderName,
          russianFallback: decision.russianFallback,
          links: {
            issue: `${site}/r/${click.token}/issue`,
            privacy: `${site}/r/${click.token}/privacy`,
            unsubscribe: `${site}/${delivery.language}/unsubscribe/${unsub.token}`,
          },
        });
        if (decision.russianFallback && !fallbackLogged.has(String(fresh.id))) {
          reportError('russian translation unavailable; sent the english fallback', undefined, {
            digestId: fresh.id,
          });
          fallbackLogged.add(String(fresh.id));
        }

        const result = await sendWithRateLimit(send, sleep, {
          to: delivery.email,
          subject: email.subject,
          text: email.text,
          html: email.html,
          fromName: fresh.senderName,
          replyTo: fresh.ownerEmail ?? undefined,
          idempotencyKey: `issue/${fresh.id}/subscriber/${delivery.subscriberId}`,
          headers: {
            'List-Unsubscribe': `<${site}/api/unsubscribe/${unsub.token}>`,
            'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
          },
        });

        if (result.ok) {
          await cms.patchDelivery(delivery.id, {
            status: 'sent',
            sentAt: now.toISOString(),
            resendEmailId: result.id,
          });
          continue;
        }
        const kind = failureKind(result);
        if (kind === 'permanent') {
          await cms.patchDelivery(delivery.id, {
            status: 'failed',
            attempts: 4,
            lastError: result.code ?? String(result.status),
          });
          reportError('issue delivery failed', undefined, { deliveryId: delivery.id });
          continue;
        }
        const next = applyDeliveryFailure(delivery.attempts, kind, now);
        await cms.patchDelivery(delivery.id, {
          status: next.status,
          attempts: next.attempts,
          nextAttemptAt: next.nextAttemptAt ? next.nextAttemptAt.toISOString() : null,
          lastError: result.code ?? String(result.status),
        });
        if (next.status === 'failed') {
          reportError('issue delivery failed', undefined, { deliveryId: delivery.id });
        }
      }
    }

    await postDueVk(
      deps,
      freshDigest(cms, digest.id),
      now,
      russianReady,
      fallbackLogged,
      reportError,
      postVk,
    );
    await sendOwnerKit(deps, digest.id, now, russianReady, send);
  }

  await cms.deleteExpired(now);
}

function freshDigest(cms: SubscriptionCms, id: SweepId) {
  return cms.getDigest(id);
}

async function postDueVk(
  deps: SubscriptionSweepDeps,
  digestPromise: Promise<SweepDigest>,
  now: Date,
  russianReady: boolean,
  fallbackLogged: Set<string>,
  reportError: typeof logError,
  postVk: (body: URLSearchParams) => Promise<{ postId: string }>,
): Promise<void> {
  const digest = await digestPromise;
  const token = (deps.env ?? process.env).VK_COMMUNITY_TOKEN?.trim();
  if (!digest.vkCommunityId || !token) return;
  const fresh = await deps.cms.getDigest(digest.id);
  if (fresh.hiddenFromPublic) return;
  for (const post of await deps.cms.listVkPosts(digest.id)) {
    if (post.status !== 'pending' || post.vkPostId) continue;
    const decision = decideLanguageSend({
      language: 'ru',
      russianReady,
      publishedAt: new Date(fresh.publishedAt),
      now,
    });
    if (decision.action === 'wait') continue;
    const body = decision.bodyLanguage === 'ru' && fresh.russian ? fresh.russian : fresh.english;
    const built = buildChatPosts({
      projectName: fresh.senderName,
      issueDate: fresh.publishedAt,
      english: fresh.english,
      russian: body,
      russianFallback: decision.russianFallback,
      issueUrl: (src) =>
        `${(deps.env?.PUBLIC_SITE_URL ?? '').replace(/\/$/, '')}/${decision.bodyLanguage}/projects/${fresh.slug}/issues/${fresh.id}?src=${src}`,
      subscribeUrl: (src) =>
        `${(deps.env?.PUBLIC_SITE_URL ?? '').replace(/\/$/, '')}/${decision.bodyLanguage}/projects/${fresh.slug}?src=${src}#subscribe`,
    }).find(
      (item) =>
        item.channel === 'vk' &&
        item.language === (decision.russianFallback ? 'ru' : decision.bodyLanguage),
    );
    if (decision.russianFallback && !fallbackLogged.has(`vk:${fresh.id}`)) {
      reportError('russian translation unavailable; posted the english fallback', undefined, {
        digestId: fresh.id,
      });
      fallbackLogged.add(`vk:${fresh.id}`);
    }
    try {
      const params = new URLSearchParams();
      params.set('owner_id', `-${fresh.vkCommunityId}`);
      params.set('from_group', '1');
      params.set('message', built?.text ?? '');
      params.set('access_token', token);
      params.set('v', '5.199');
      const result = await postVk(params);
      await deps.cms.patchVkPost(post.id, { status: 'published', vkPostId: result.postId });
    } catch (error) {
      await deps.cms.patchVkPost(post.id, {
        status: 'failed',
        lastError: error instanceof Error ? error.message : String(error),
      });
      reportError('vk wall post failed', error, { digestId: fresh.id });
    }
  }
}

async function sendOwnerKit(
  deps: SubscriptionSweepDeps,
  digestId: SweepId,
  now: Date,
  russianReady: boolean,
  send: SubscriptionSweepDeps['send'],
): Promise<void> {
  if (!send) return;
  const digest = await deps.cms.getDigest(digestId);
  if (digest.ownerKitSentAt || digest.hiddenFromPublic || !digest.ownerEmail) return;
  if (!digest.subscriberFanoutAt && digest.issueTextStatus !== 'ready') return;
  const decision = decideLanguageSend({
    language: 'ru',
    russianReady,
    publishedAt: new Date(digest.publishedAt),
    now,
  });
  if (decision.action === 'wait') return;
  const posts = buildChatPosts({
    projectName: digest.senderName,
    issueDate: digest.publishedAt,
    english: digest.english,
    russian: digest.russian ?? digest.english,
    russianFallback: decision.russianFallback,
    issueUrl: (src) => `?src=${src}`,
    subscribeUrl: (src) => `?src=${src}`,
  });
  const kit = formatOwnerKit(posts);
  const result = await send({
    to: digest.ownerEmail,
    subject: `${digest.senderName} — posts`,
    text: kit.text,
    html: kit.html,
    fromName: digest.senderName,
    idempotencyKey: `owner-kit/${digest.id}`,
  });
  if (result.ok) {
    await deps.cms.patchDigest(digest.id, { ownerKitSentAt: now.toISOString() });
  }
}
