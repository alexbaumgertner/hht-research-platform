import type { ChatIssueText, EmailLanguage } from '@hht/shared';

import { CmsClient, type CmsId } from '../cms/client.js';
import type {
  SubscriptionCms,
  SweepDelivery,
  SweepDigest,
  SweepId,
  SweepVkPost,
} from './subscriptionSweep.js';

const russianText = new Map<string, ChatIssueText>();

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
}

function relation(value: unknown): CmsId | null {
  if (typeof value === 'string' || typeof value === 'number') return value;
  const id = record(value).id;
  return typeof id === 'string' || typeof id === 'number' ? id : null;
}

function englishText(doc: Record<string, unknown>): ChatIssueText {
  const points = Array.isArray(doc.issueSummaryPoints) ? doc.issueSummaryPoints : [];
  const sentences = Array.isArray(doc.issueItemSentences) ? doc.issueItemSentences : [];
  const publications = Array.isArray(doc.publications) ? doc.publications : [];
  const byId = new Map(publications.map((item) => [String(relation(item)), record(item)]));
  return {
    summaryPoints: points.map((point) => String(record(point).text ?? '')),
    items: sentences.map((row) => {
      const sentence = record(row);
      const publication = byId.get(String(relation(sentence.publication))) ?? {};
      return {
        title: String(publication.title ?? 'Untitled'),
        source: String(publication.sourceType ?? 'Source'),
        date:
          typeof publication.publishedOrUpdatedAt === 'string'
            ? publication.publishedOrUpdatedAt
            : null,
        sentence: String(sentence.sentence ?? ''),
        isTrial: publication.sourceType === 'clinicaltrials',
      };
    }),
  };
}

function toDigest(doc: Record<string, unknown>, project: Record<string, unknown>): SweepDigest {
  const id = relation(doc.id) ?? 0;
  const owner = record(project.owner);
  return {
    id,
    projectId: relation(doc.project) ?? relation(project.id) ?? 0,
    slug: String(project.slug ?? ''),
    projectName: String(project.name ?? ''),
    senderName: String(project.emailFromName || project.name || ''),
    ownerEmail: typeof owner.email === 'string' ? owner.email : null,
    publishedAt: String(doc.publishedAt ?? ''),
    hiddenFromPublic: Boolean(doc.hiddenFromPublic),
    issueTextStatus: (doc.issueTextStatus as SweepDigest['issueTextStatus']) ?? null,
    subscriberFanoutAt: (doc.subscriberFanoutAt as string | null) ?? null,
    subscriberSendBlockedAt: (doc.subscriberSendBlockedAt as string | null) ?? null,
    ownerKitSentAt: (doc.ownerKitSentAt as string | null) ?? null,
    vkCommunityId: typeof project.vkCommunityId === 'string' ? project.vkCommunityId : null,
    english: englishText(doc),
    russian: russianText.get(String(id)) ?? null,
  };
}

export function subscriptionCms(client: CmsClient): SubscriptionCms {
  const digests = new Map<string, SweepDigest>();

  async function loadDigest(id: SweepId): Promise<SweepDigest> {
    const cached = digests.get(String(id));
    if (cached) return cached;
    const listed = await client.listSubscriptionDigests();
    for (const doc of listed.docs) {
      const project = record(record(doc).project);
      const mapped = toDigest(record(doc), project);
      digests.set(String(mapped.id), mapped);
    }
    const found = digests.get(String(id));
    if (!found) throw new Error(`Digest ${id} was not in the subscription list`);
    return found;
  }

  return {
    async listDigests() {
      digests.clear();
      const listed = await client.listSubscriptionDigests();
      return listed.docs.map((doc) => {
        const mapped = toDigest(record(doc), record(record(doc).project));
        digests.set(String(mapped.id), mapped);
        return mapped;
      });
    },
    getDigest: loadDigest,
    async patchDigest(id, data) {
      await client.patchDigest(id, data as Record<string, unknown>);
      const current = digests.get(String(id));
      if (current) Object.assign(current, data);
    },
    async listConfirmedSubscribers(projectId) {
      const result = await client.listConfirmedSubscribers(projectId);
      return result.docs.map((doc) => ({
        id: doc.id,
        projectId,
        email: doc.email,
        language: doc.language,
        status: 'confirmed' as const,
        source: doc.source ?? 'other',
        confirmationExpiresAt: null,
        unsubscribedAt: null,
      }));
    },
    async listDeliveries(digestId) {
      const result = await client.listIssueDeliveries(digestId);
      return result.docs.map((doc) => {
        const subscriber = record(doc.subscriber);
        return {
          id: relation(doc.id) ?? 0,
          digestId,
          subscriberId: relation(doc.subscriber) ?? 0,
          status: doc.status as SweepDelivery['status'],
          attempts: Number(doc.attempts ?? 0),
          nextAttemptAt: (doc.nextAttemptAt as string | null) ?? null,
          language: subscriber.language === 'ru' ? 'ru' : 'en',
          email: String(subscriber.email ?? ''),
        };
      });
    },
    async insertDelivery(input) {
      try {
        const created = await client.createIssueDelivery({
          digest: input.digestId,
          subscriber: input.subscriberId,
          project: (await loadDigest(input.digestId)).projectId,
          status: 'pending',
          attempts: 0,
          clickTokenHash: input.clickTokenHash,
        });
        const subscriber = (
          await client.listConfirmedSubscribers((await loadDigest(input.digestId)).projectId)
        ).docs.find((row) => String(row.id) === String(input.subscriberId));
        return {
          id: created.doc.id,
          digestId: input.digestId,
          subscriberId: input.subscriberId,
          status: 'pending',
          attempts: 0,
          nextAttemptAt: null,
          language: (subscriber?.language ?? 'en') as EmailLanguage,
          email: subscriber?.email ?? '',
        };
      } catch {
        return 'conflict' as const;
      }
    },
    async patchDelivery(id, data) {
      await client.patchIssueDelivery(id, data as Record<string, unknown>);
    },
    async listVkPosts(digestId) {
      const result = await client.listVkPostsForDigest(digestId);
      return result.docs.map((doc) => ({
        id: relation(doc.id) ?? 0,
        digestId,
        projectId: relation(doc.project) ?? 0,
        vkCommunityId: String(doc.vkCommunityId ?? ''),
        status: doc.status as SweepVkPost['status'],
        vkPostId: (doc.vkPostId as string | null) ?? null,
      }));
    },
    async insertVkPost({ digest }) {
      if (!digest.vkCommunityId) return 'skip' as const;
      try {
        const created = await client.createVkPost({
          project: digest.projectId,
          digest: digest.id,
          vkCommunityId: digest.vkCommunityId,
          status: 'pending',
        });
        return {
          id: created.doc.id,
          digestId: digest.id,
          projectId: digest.projectId,
          vkCommunityId: digest.vkCommunityId,
          status: 'pending' as const,
          vkPostId: null,
        };
      } catch {
        return 'conflict' as const;
      }
    },
    async patchVkPost(id, data) {
      await client.patchVkPost(id, data as Record<string, unknown>);
    },
    async translate(digestId) {
      const base = (process.env.PUBLIC_SITE_URL ?? '').replace(/\/$/, '');
      const res = await fetch(`${base}/api/internal/issues/${digestId}/translate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Payload-API-Key': process.env.PAYLOAD_API_KEY ?? '',
        },
        body: JSON.stringify({ locale: 'ru' }),
      });
      if (!res.ok) return 'failed';
      const body = (await res.json()) as {
        status?: 'ready' | 'unavailable' | 'failed';
        text?: { summaryPoints?: string[]; itemSentences?: Array<{ sentence?: string }> };
      };
      if (body.status === 'ready' && body.text) {
        const current = digests.get(String(digestId));
        const sentences = body.text.itemSentences ?? [];
        const text: ChatIssueText = {
          summaryPoints: body.text.summaryPoints ?? current?.english.summaryPoints ?? [],
          items: (current?.english.items ?? []).map((item, index) => ({
            ...item,
            sentence: sentences[index]?.sentence ?? item.sentence,
          })),
        };
        russianText.set(String(digestId), text);
        if (current) current.russian = text;
      }
      return body.status ?? 'failed';
    },
    async deleteExpired(now) {
      const pendingBefore = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
      const unsubBefore = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
      const rateBefore = pendingBefore;
      await client.deleteWhere(
        'subscribers',
        new URLSearchParams({
          'where[and][0][status][equals]': 'pending',
          'where[and][1][confirmationExpiresAt][less_than]': pendingBefore,
        }),
      );
      await client.deleteWhere(
        'subscribers',
        new URLSearchParams({
          'where[and][0][status][equals]': 'unsubscribed',
          'where[and][1][unsubscribedAt][less_than]': unsubBefore,
        }),
      );
      await client.deleteWhere(
        'subscribe-rate-limits',
        new URLSearchParams({ 'where[createdAt][less_than]': rateBefore }),
      );
    },
  };
}
