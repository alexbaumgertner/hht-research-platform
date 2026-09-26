import {
  sweepSubscriptions,
  type SubscriptionCms,
  type SweepDelivery,
  type SweepDigest,
  type SweepSubscriber,
  type SweepVkPost,
} from './subscriptionSweep.js';

const SECRET = 'test-secret';
const SITE = 'https://example.com';

function digest(overrides: Partial<SweepDigest> = {}): SweepDigest {
  return {
    id: 1,
    projectId: 2,
    slug: 'demo',
    projectName: 'Demo project',
    senderName: 'Demo project',
    ownerEmail: 'owner@example.com',
    publishedAt: '2026-09-26T12:00:00.000Z',
    hiddenFromPublic: false,
    issueTextStatus: 'ready',
    subscriberFanoutAt: null,
    subscriberSendBlockedAt: null,
    ownerKitSentAt: null,
    vkCommunityId: null,
    english: {
      summaryPoints: ['English point.'],
      items: [
        {
          title: 'Title',
          source: 'PubMed',
          date: '1 September 2026',
          sentence: 'A sentence.',
          isTrial: false,
        },
      ],
    },
    russian: {
      summaryPoints: ['Русский пункт.'],
      items: [
        {
          title: 'Заголовок',
          source: 'PubMed',
          date: '1 сентября 2026',
          sentence: 'Предложение.',
          isTrial: false,
        },
      ],
    },
    ...overrides,
  };
}

function subscriber(overrides: Partial<SweepSubscriber> = {}): SweepSubscriber {
  return {
    id: 10,
    projectId: 2,
    email: 'reader@example.com',
    language: 'en',
    status: 'confirmed',
    source: 'other',
    confirmationExpiresAt: null,
    unsubscribedAt: null,
    ...overrides,
  };
}

function createCms(input: {
  digests: SweepDigest[];
  subscribers: SweepSubscriber[];
  deliveries?: SweepDelivery[];
  vk?: SweepVkPost[];
  translate?: (id: SweepDigest['id']) => 'ready' | 'unavailable' | 'failed';
}): SubscriptionCms & { digests: SweepDigest[]; deliveries: SweepDelivery[]; vk: SweepVkPost[] } {
  const state = {
    digests: input.digests,
    subscribers: input.subscribers,
    deliveries: input.deliveries ?? [],
    vk: input.vk ?? [],
    nextId: 100,
  };
  const cms: SubscriptionCms & {
    digests: SweepDigest[];
    deliveries: SweepDelivery[];
    vk: SweepVkPost[];
  } = {
    digests: state.digests,
    deliveries: state.deliveries,
    vk: state.vk,
    async listDigests() {
      return state.digests;
    },
    async getDigest(id) {
      const row = state.digests.find((item) => String(item.id) === String(id));
      if (!row) throw new Error('missing digest');
      return row;
    },
    async patchDigest(id, data) {
      const row = await this.getDigest(id);
      Object.assign(row, data);
    },
    async listConfirmedSubscribers(projectId) {
      return state.subscribers.filter(
        (row) => String(row.projectId) === String(projectId) && row.status === 'confirmed',
      );
    },
    async listDeliveries(digestId) {
      return state.deliveries.filter((row) => String(row.digestId) === String(digestId));
    },
    async insertDelivery(row) {
      const subscriber = state.subscribers.find(
        (item) => String(item.id) === String(row.subscriberId),
      );
      if (!subscriber) return 'conflict';
      const created: SweepDelivery = {
        id: state.nextId++,
        digestId: row.digestId,
        subscriberId: row.subscriberId,
        status: 'pending',
        attempts: 0,
        nextAttemptAt: null,
        language: subscriber.language,
        email: subscriber.email,
      };
      state.deliveries.push(created);
      return created;
    },
    async patchDelivery(id, data) {
      const row = state.deliveries.find((item) => String(item.id) === String(id));
      if (row) Object.assign(row, data);
    },
    async listVkPosts(digestId) {
      return state.vk.filter((row) => String(row.digestId) === String(digestId));
    },
    async insertVkPost({ digest: row }) {
      if (!row.vkCommunityId) return 'skip';
      if (state.vk.some((item) => String(item.digestId) === String(row.id))) return 'conflict';
      const created: SweepVkPost = {
        id: state.nextId++,
        digestId: row.id,
        projectId: row.projectId,
        vkCommunityId: row.vkCommunityId,
        status: 'pending',
        vkPostId: null,
      };
      state.vk.push(created);
      return created;
    },
    async patchVkPost(id, data) {
      const row = state.vk.find((item) => String(item.id) === String(id));
      if (row) Object.assign(row, data);
    },
    async translate(id) {
      const status = input.translate?.(id) ?? 'failed';
      if (status === 'ready') {
        const row = state.digests.find((item) => String(item.id) === String(id));
        if (row && !row.russian) {
          row.russian = row.english;
        }
      }
      return status;
    },
    async deleteExpired() {},
  };
  return cms;
}

const openEnv = {
  RESEND_API_KEY: 'key',
  RESEND_FROM_EMAIL: 'news@example.com',
  PUBLIC_SITE_URL: SITE,
  PAYLOAD_SECRET: SECRET,
};

describe('sweepSubscriptions', () => {
  it('fans out one pending row per confirmed subscriber and does not send again', async () => {
    const cms = createCms({
      digests: [digest()],
      subscribers: [
        subscriber({ id: 1, language: 'en', email: 'en@example.com' }),
        subscriber({ id: 2, language: 'ru', email: 'ru@example.com' }),
      ],
    });
    const sent: string[] = [];
    const send = async (message: { to: string; idempotencyKey: string }) => {
      sent.push(message.idempotencyKey);
      return { ok: true as const, id: `re_${sent.length}` };
    };
    await sweepSubscriptions({
      cms,
      send,
      env: openEnv,
      now: () => new Date('2026-09-26T18:00:00.000Z'),
    });
    expect(cms.digests[0]?.subscriberFanoutAt).toBeTruthy();
    expect(cms.deliveries).toHaveLength(2);
    expect(cms.deliveries.every((row) => row.status === 'sent')).toBe(true);
    const issueSends = sent.filter((key) => key.startsWith('issue/'));
    await sweepSubscriptions({
      cms,
      send,
      env: openEnv,
      now: () => new Date('2026-09-26T19:00:00.000Z'),
    });
    expect(sent.filter((key) => key.startsWith('issue/'))).toEqual(issueSends);
  });

  it('sends English without waiting and leaves Russian pending inside 6 hours', async () => {
    const cms = createCms({
      digests: [digest({ russian: null, publishedAt: '2026-09-26T12:00:00.000Z' })],
      subscribers: [
        subscriber({ id: 1, language: 'en', email: 'en@example.com' }),
        subscriber({ id: 2, language: 'ru', email: 'ru@example.com' }),
      ],
      translate: () => 'failed',
    });
    let translations = 0;
    const original = cms.translate.bind(cms);
    cms.translate = async (id) => {
      translations += 1;
      return original(id);
    };
    const sent: string[] = [];
    await sweepSubscriptions({
      cms,
      env: openEnv,
      now: () => new Date('2026-09-26T13:00:00.000Z'),
      send: async (message) => {
        sent.push(message.to);
        return { ok: true, id: 're_1' };
      },
    });
    expect(translations).toBeGreaterThan(0);
    expect(sent).toContain('en@example.com');
    expect(sent).not.toContain('ru@example.com');
    expect(cms.deliveries.find((row) => row.email === 'ru@example.com')?.status).toBe('pending');
  });

  it('sends the English body plus the Russian note after 6 hours and logs once', async () => {
    const errors: string[] = [];
    const cms = createCms({
      digests: [digest({ russian: null, publishedAt: '2026-09-26T06:00:00.000Z' })],
      subscribers: [subscriber({ language: 'ru', email: 'ru@example.com' })],
      translate: () => 'failed',
    });
    const sent: string[] = [];
    await sweepSubscriptions({
      cms,
      env: openEnv,
      now: () => new Date('2026-09-26T13:00:00.000Z'),
      logError: (message) => {
        errors.push(message);
      },
      send: async (message) => {
        sent.push(message.text);
        return { ok: true, id: 're_1' };
      },
    });
    expect(sent[0]).toContain('English point.');
    expect(sent[0]).toContain('Перевод этого выпуска недоступен.');
    expect(errors.filter((message) => message.includes('fallback'))).toHaveLength(1);
    expect(cms.deliveries[0]?.status).toBe('sent');
  });

  it('defers a daily quota without increasing attempts', async () => {
    const cms = createCms({
      digests: [digest({ subscriberFanoutAt: '2026-09-26T12:00:00.000Z' })],
      subscribers: [subscriber()],
      deliveries: [
        {
          id: 5,
          digestId: 1,
          subscriberId: 10,
          status: 'pending',
          attempts: 1,
          nextAttemptAt: null,
          language: 'en',
          email: 'reader@example.com',
        },
      ],
    });
    await sweepSubscriptions({
      cms,
      env: openEnv,
      now: () => new Date('2026-09-26T15:00:00.000Z'),
      send: async () => ({ ok: false, status: 429, code: 'daily_quota_exceeded' }),
    });
    expect(cms.deliveries[0]).toMatchObject({
      status: 'pending',
      attempts: 1,
      nextAttemptAt: '2026-09-27T00:10:00.000Z',
    });
  });

  it('fails the delivery when attempts reach 4', async () => {
    const cms = createCms({
      digests: [digest({ subscriberFanoutAt: '2026-09-26T12:00:00.000Z' })],
      subscribers: [subscriber()],
      deliveries: [
        {
          id: 5,
          digestId: 1,
          subscriberId: 10,
          status: 'pending',
          attempts: 3,
          nextAttemptAt: '2026-09-26T14:00:00.000Z',
          language: 'en',
          email: 'reader@example.com',
        },
      ],
    });
    const errors: string[] = [];
    await sweepSubscriptions({
      cms,
      env: openEnv,
      now: () => new Date('2026-09-26T15:00:00.000Z'),
      logError: (message) => errors.push(message),
      send: async () => ({ ok: false, status: 503 }),
    });
    expect(cms.deliveries[0]).toMatchObject({ status: 'failed', attempts: 4 });
    expect(errors.length).toBeGreaterThan(0);
  });

  it('skips pending rows when the issue is hidden', async () => {
    const cms = createCms({
      digests: [digest({ hiddenFromPublic: true, subscriberFanoutAt: '2026-09-26T12:00:00.000Z' })],
      subscribers: [subscriber()],
      deliveries: [
        {
          id: 5,
          digestId: 1,
          subscriberId: 10,
          status: 'pending',
          attempts: 0,
          nextAttemptAt: null,
          language: 'en',
          email: 'reader@example.com',
        },
      ],
    });
    await sweepSubscriptions({
      cms,
      env: openEnv,
      now: () => new Date('2026-09-26T15:00:00.000Z'),
      send: async () => ({ ok: true, id: 're_should_not' }),
    });
    expect(cms.deliveries[0]?.status).toBe('skipped');
  });

  it('blocks fan-out when issue text failed', async () => {
    const errors: string[] = [];
    const cms = createCms({
      digests: [digest({ issueTextStatus: 'failed', russian: null })],
      subscribers: [subscriber()],
    });
    await sweepSubscriptions({
      cms,
      env: openEnv,
      now: () => new Date('2026-09-26T15:00:00.000Z'),
      logError: (message) => errors.push(message),
      send: async () => ({ ok: true, id: 're_no' }),
    });
    expect(cms.deliveries).toHaveLength(0);
    expect(cms.digests[0]?.subscriberSendBlockedAt).toBeTruthy();
    expect(errors).toHaveLength(1);
  });

  it('mails only the owner from a resend.dev address and warns once', async () => {
    const warnings: string[] = [];
    const cms = createCms({
      digests: [digest()],
      subscribers: [
        subscriber({ id: 1, email: 'owner@example.com' }),
        subscriber({ id: 2, email: 'reader@example.com' }),
      ],
    });
    const sent: string[] = [];
    await sweepSubscriptions({
      cms,
      now: () => new Date('2026-09-26T18:00:00.000Z'),
      env: { ...openEnv, RESEND_FROM_EMAIL: 'onboarding@resend.dev' },
      logWarning: (message) => warnings.push(message),
      send: async (message) => {
        sent.push(message.to);
        return { ok: true, id: 're_1' };
      },
    });
    expect(sent.filter((to) => to === 'reader@example.com')).toHaveLength(0);
    expect(sent).toContain('owner@example.com');
    expect(warnings).toHaveLength(1);
    expect(cms.deliveries.map((row) => row.email)).toEqual(['owner@example.com']);
  });

  it('does not create a vk row when the community or token is missing', async () => {
    const errors: string[] = [];
    const cms = createCms({
      digests: [digest({ vkCommunityId: '' })],
      subscribers: [],
    });
    await sweepSubscriptions({
      cms,
      env: openEnv,
      now: () => new Date('2026-09-26T18:00:00.000Z'),
      logError: (message) => errors.push(message),
      send: async () => ({ ok: true, id: 'unused' }),
      postVk: async () => ({ postId: '1' }),
    });
    expect(cms.vk).toHaveLength(0);
    expect(errors).toHaveLength(0);
  });

  it('posts to VK once with from_group and a negative owner id', async () => {
    const cms = createCms({
      digests: [digest({ vkCommunityId: '123' })],
      subscribers: [],
    });
    const calls: URLSearchParams[] = [];
    const run = () =>
      sweepSubscriptions({
        cms,
        env: { ...openEnv, VK_COMMUNITY_TOKEN: 'vk-token' },
        now: () => new Date('2026-09-26T18:00:00.000Z'),
        send: async () => ({ ok: true, id: 'unused' }),
        postVk: async (body) => {
          calls.push(body);
          return { postId: '99' };
        },
      });
    await run();
    expect(calls).toHaveLength(1);
    expect(calls[0]?.get('from_group')).toBe('1');
    expect(calls[0]?.get('owner_id')).toBe('-123');
    expect(cms.vk[0]).toMatchObject({ status: 'published', vkPostId: '99' });
    await run();
    expect(calls).toHaveLength(1);
  });

  it('marks a VK failure without changing deliveries', async () => {
    const errors: string[] = [];
    const cms = createCms({
      digests: [digest({ vkCommunityId: '123', subscriberFanoutAt: '2026-09-26T12:00:00.000Z' })],
      subscribers: [subscriber()],
      deliveries: [
        {
          id: 5,
          digestId: 1,
          subscriberId: 10,
          status: 'sent',
          attempts: 0,
          nextAttemptAt: null,
          language: 'en',
          email: 'reader@example.com',
        },
      ],
      vk: [
        {
          id: 8,
          digestId: 1,
          projectId: 2,
          vkCommunityId: '123',
          status: 'pending',
          vkPostId: null,
        },
      ],
    });
    await sweepSubscriptions({
      cms,
      env: { ...openEnv, VK_COMMUNITY_TOKEN: 'vk-token' },
      now: () => new Date('2026-09-26T18:00:00.000Z'),
      logError: (message) => errors.push(message),
      send: async () => ({ ok: true, id: 'unused' }),
      postVk: async () => {
        throw new Error('vk down');
      },
    });
    expect(cms.vk[0]?.status).toBe('failed');
    expect(cms.deliveries[0]?.status).toBe('sent');
    expect(errors.some((message) => message.includes('vk'))).toBe(true);
  });

  it('skips a pending VK post when the issue is hidden and leaves a published post', async () => {
    const hidden = createCms({
      digests: [digest({ hiddenFromPublic: true, vkCommunityId: '123' })],
      subscribers: [],
      vk: [
        {
          id: 8,
          digestId: 1,
          projectId: 2,
          vkCommunityId: '123',
          status: 'pending',
          vkPostId: null,
        },
      ],
    });
    let calls = 0;
    await sweepSubscriptions({
      cms: hidden,
      env: { ...openEnv, VK_COMMUNITY_TOKEN: 'vk-token' },
      now: () => new Date('2026-09-26T18:00:00.000Z'),
      postVk: async () => {
        calls += 1;
        return { postId: '1' };
      },
    });
    expect(hidden.vk[0]?.status).toBe('skipped');
    expect(calls).toBe(0);

    const published = createCms({
      digests: [digest({ hiddenFromPublic: true, vkCommunityId: '123' })],
      subscribers: [],
      vk: [
        {
          id: 8,
          digestId: 1,
          projectId: 2,
          vkCommunityId: '123',
          status: 'published',
          vkPostId: '55',
        },
      ],
    });
    await sweepSubscriptions({
      cms: published,
      env: { ...openEnv, VK_COMMUNITY_TOKEN: 'vk-token' },
      now: () => new Date('2026-09-26T18:00:00.000Z'),
      postVk: async () => ({ postId: 'nope' }),
    });
    expect(published.vk[0]).toMatchObject({ status: 'published', vkPostId: '55' });
  });

  it('posts the English fallback once when Russian is still missing after 6 hours', async () => {
    const cms = createCms({
      digests: [
        digest({ vkCommunityId: '123', russian: null, publishedAt: '2026-09-26T06:00:00.000Z' }),
      ],
      subscribers: [],
      translate: () => 'failed',
    });
    const messages: string[] = [];
    await sweepSubscriptions({
      cms,
      env: { ...openEnv, VK_COMMUNITY_TOKEN: 'vk-token' },
      now: () => new Date('2026-09-26T13:00:00.000Z'),
      logError: () => {},
      send: async () => ({ ok: true, id: 'unused' }),
      postVk: async (body) => {
        messages.push(body.get('message') ?? '');
        return { postId: '77' };
      },
    });
    expect(messages[0]).toContain('English point.');
    expect(messages[0]).toContain('Перевод этого выпуска недоступен.');
    cms.digests[0]!.russian = cms.digests[0]!.english;
    await sweepSubscriptions({
      cms,
      env: { ...openEnv, VK_COMMUNITY_TOKEN: 'vk-token' },
      now: () => new Date('2026-09-26T20:00:00.000Z'),
      send: async () => ({ ok: true, id: 'unused' }),
      postVk: async () => ({ postId: '78' }),
    });
    expect(cms.vk[0]?.vkPostId).toBe('77');
  });
});
