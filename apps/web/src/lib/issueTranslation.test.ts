import {
  decideRow,
  resolveIssueTranslation,
  TRANSLATION_LEASE_MS,
  TRANSLATION_RETRY_AFTER_MS,
  type TranslationClaim,
  type TranslationFinish,
  type TranslationKey,
  type TranslationRow,
  type TranslationStore,
} from '@/lib/issueTranslation';
import type { IssueText, IssueTranslator } from '@/lib/issueTranslator';

/** In-memory `issue-translations` with the same unique (digest, locale) constraint. */
class FakeStore implements TranslationStore {
  rows = new Map<string, TranslationRow>();
  private nextId = 1;
  deletedIds: string[] = [];

  private static keyOf(key: TranslationKey) {
    return `${key.digestId}:${key.locale}`;
  }

  seed(key: TranslationKey, row: Omit<TranslationRow, 'id'>): TranslationRow {
    const stored = { ...row, id: String(this.nextId++) };
    this.rows.set(FakeStore.keyOf(key), stored);
    return stored;
  }

  async find(key: TranslationKey) {
    const row = this.rows.get(FakeStore.keyOf(key));
    return row ? { ...row } : null;
  }

  async create(key: TranslationKey, claim: TranslationClaim) {
    const k = FakeStore.keyOf(key);
    if (this.rows.has(k)) throw new Error('duplicate key value violates unique constraint');
    const row: TranslationRow = {
      id: String(this.nextId++),
      status: 'pending',
      sourceRevision: claim.sourceRevision,
      leaseExpiresAt: claim.leaseExpiresAt,
      retryAfter: null,
      attempts: claim.attempts,
      text: null,
    };
    this.rows.set(k, row);
    return { ...row };
  }

  async deleteById(id: string) {
    this.deletedIds.push(id);
    for (const [k, row] of this.rows) {
      if (row.id === id) this.rows.delete(k);
    }
  }

  async finish(id: string, result: TranslationFinish) {
    for (const row of this.rows.values()) {
      if (row.id !== id) continue;
      row.status = result.status;
      row.leaseExpiresAt = null;
      if (result.status === 'ready') row.text = result.text;
      else row.retryAfter = result.retryAfter;
      return true;
    }
    return false;
  }
}

const KEY: TranslationKey = { digestId: '42', locale: 'ru' };

const SOURCE: IssueText = {
  summaryPoints: ['First point.', 'Second point.', 'Third point.'],
  itemSentences: [
    { publicationId: '10', sentence: 'A study looked at a medicine.' },
    { publicationId: '11', sentence: 'A study is recruiting.' },
  ],
};

const RU: IssueText = {
  summaryPoints: SOURCE.summaryPoints.map((point) => `[ru] ${point}`),
  itemSentences: SOURCE.itemSentences.map((row) => ({ ...row, sentence: `[ru] ${row.sentence}` })),
};

/**
 * A controllable clock: `sleep` advances time instead of waiting. It yields a
 * macrotask first, so work that settles within microtasks (an instant translator)
 * always beats the deadline and an open translator call always loses to it.
 */
function fakeClock(start = Date.parse('2026-09-28T12:00:00.000Z')) {
  let current = start;
  return {
    now: () => current,
    sleep: async (ms: number) => {
      await new Promise((resolve) => setImmediate(resolve));
      current += ms;
    },
    advance: (ms: number) => {
      current += ms;
    },
  };
}

type ControlledTranslator = IssueTranslator & { resolveNext: () => void };

/** Translator whose calls stay open until the test resolves them. */
function controlledTranslator(result: IssueText = RU): ControlledTranslator {
  const pending: Array<(text: IssueText) => void> = [];
  return {
    kind: 'stub',
    translate: () => new Promise<IssueText>((resolve) => pending.push(resolve)),
    resolveNext: () => pending.shift()?.(result),
  };
}

function instantTranslator(result: IssueText = RU) {
  const translator = {
    kind: 'stub' as const,
    calls: 0,
    translate: async () => {
      translator.calls += 1;
      return result;
    },
  };
  return translator;
}

function logRecorder() {
  const lines: Array<[string, Record<string, unknown>]> = [];
  return {
    lines,
    log: (message: string, context: Record<string, unknown>) => {
      lines.push([message, context]);
    },
  };
}

function baseInput(
  store: FakeStore,
  translator: IssueTranslator,
  clock: ReturnType<typeof fakeClock>,
  kept: Array<Promise<unknown>> = [],
) {
  return {
    store,
    translator,
    key: KEY,
    revision: 3,
    source: SOURCE,
    deadline: clock.now() + 8_000,
    keepAlive: (work: Promise<unknown>) => {
      kept.push(work);
    },
    now: clock.now,
    sleep: clock.sleep,
  };
}

describe('decideRow', () => {
  const now = Date.parse('2026-09-28T12:00:00.000Z');
  const row = (patch: Partial<TranslationRow>): TranslationRow => ({
    id: '1',
    status: 'ready',
    sourceRevision: 3,
    leaseExpiresAt: null,
    retryAfter: null,
    attempts: 1,
    text: RU,
    ...patch,
  });

  it('serves a ready row at the current revision', () => {
    expect(decideRow(row({}), 3, now)).toBe('serve');
  });

  it('reclaims a row translated from an older revision', () => {
    expect(decideRow(row({ sourceRevision: 2 }), 3, now)).toBe('reclaim');
  });

  it('waits on a pending row with a live lease', () => {
    expect(
      decideRow(row({ status: 'pending', text: null, leaseExpiresAt: new Date(now + 1) }), 3, now),
    ).toBe('wait');
  });

  it('reclaims a pending row whose lease expired', () => {
    expect(
      decideRow(row({ status: 'pending', text: null, leaseExpiresAt: new Date(now - 1) }), 3, now),
    ).toBe('reclaim');
  });

  it('respects the failure cooldown, then reclaims', () => {
    const failed = { status: 'failed' as const, text: null };
    expect(decideRow(row({ ...failed, retryAfter: new Date(now + 1) }), 3, now)).toBe('cooldown');
    expect(decideRow(row({ ...failed, retryAfter: new Date(now - 1) }), 3, now)).toBe('reclaim');
  });
});

describe('resolveIssueTranslation', () => {
  it('claims, translates, and stores a ready row when none exists', async () => {
    const store = new FakeStore();
    const translator = instantTranslator();
    const clock = fakeClock();

    const outcome = await resolveIssueTranslation(baseInput(store, translator, clock));

    expect(outcome).toEqual({ status: 'ready', text: RU });
    expect(translator.calls).toBe(1);
    const row = await store.find(KEY);
    expect(row).toMatchObject({ status: 'ready', sourceRevision: 3, attempts: 1, text: RU });
  });

  it('serves a cached ready row without calling the translator', async () => {
    const store = new FakeStore();
    store.seed(KEY, {
      status: 'ready',
      sourceRevision: 3,
      leaseExpiresAt: null,
      retryAfter: null,
      attempts: 1,
      text: RU,
    });
    const translator = instantTranslator();

    const outcome = await resolveIssueTranslation(baseInput(store, translator, fakeClock()));

    expect(outcome).toEqual({ status: 'ready', text: RU });
    expect(translator.calls).toBe(0);
  });

  it('turns concurrent requests into one owner and waiters (lost race → waiter)', async () => {
    const store = new FakeStore();
    const kept: Array<Promise<unknown>> = [];
    const translator = {
      kind: 'stub' as const,
      calls: 0,
      translate: async () => {
        translator.calls += 1;
        await new Promise((resolve) => setTimeout(resolve, 50));
        return RU;
      },
    };

    // Real time: waiters poll every 400 ms while the owner's call is in flight.
    const requests = Array.from({ length: 8 }, () =>
      resolveIssueTranslation({
        store,
        translator,
        key: KEY,
        revision: 3,
        source: SOURCE,
        deadline: Date.now() + 3_000,
        keepAlive: (work) => {
          kept.push(work);
        },
      }),
    );

    const outcomes = await Promise.all(requests);

    expect(translator.calls).toBe(1);
    expect(kept).toHaveLength(1);
    expect(store.rows.size).toBe(1);
    expect((await store.find(KEY))?.attempts).toBe(1);
    for (const outcome of outcomes) expect(outcome).toEqual({ status: 'ready', text: RU });
  });

  it('answers pending at the deadline and finishes the row in the background', async () => {
    const store = new FakeStore();
    const translator = controlledTranslator();
    const clock = fakeClock();
    const kept: Array<Promise<unknown>> = [];

    const outcome = await resolveIssueTranslation(baseInput(store, translator, clock, kept));
    expect(outcome).toEqual({ status: 'pending' });
    expect((await store.find(KEY))?.status).toBe('pending');

    translator.resolveNext();
    await Promise.all(kept);
    expect((await store.find(KEY))?.status).toBe('ready');
  });

  it('waits on a live lease without starting a second translation', async () => {
    const store = new FakeStore();
    const clock = fakeClock();
    store.seed(KEY, {
      status: 'pending',
      sourceRevision: 3,
      leaseExpiresAt: new Date(clock.now() + TRANSLATION_LEASE_MS),
      retryAfter: null,
      attempts: 1,
      text: null,
    });
    const translator = instantTranslator();

    const outcome = await resolveIssueTranslation(baseInput(store, translator, clock));

    expect(outcome).toEqual({ status: 'pending' });
    expect(translator.calls).toBe(0);
  });

  it('reclaims an expired lease by deleting the old row by id', async () => {
    const store = new FakeStore();
    const clock = fakeClock();
    const stale = store.seed(KEY, {
      status: 'pending',
      sourceRevision: 3,
      leaseExpiresAt: new Date(clock.now() - 1),
      retryAfter: null,
      attempts: 1,
      text: null,
    });
    const translator = instantTranslator();

    const outcome = await resolveIssueTranslation(baseInput(store, translator, clock));

    expect(outcome).toEqual({ status: 'ready', text: RU });
    expect(store.deletedIds).toEqual([stale.id]);
    const row = await store.find(KEY);
    expect(row?.id).not.toBe(stale.id);
    expect(row?.attempts).toBe(2);
  });

  it('serves English during the failure cooldown and retries once it expires', async () => {
    const store = new FakeStore();
    const clock = fakeClock();
    store.seed(KEY, {
      status: 'failed',
      sourceRevision: 3,
      leaseExpiresAt: null,
      retryAfter: new Date(clock.now() + TRANSLATION_RETRY_AFTER_MS),
      attempts: 1,
      text: null,
    });
    const translator = instantTranslator();

    expect(await resolveIssueTranslation(baseInput(store, translator, clock))).toEqual({
      status: 'failed',
    });
    expect(translator.calls).toBe(0);

    clock.advance(TRANSLATION_RETRY_AFTER_MS + 1);
    expect(await resolveIssueTranslation(baseInput(store, translator, clock))).toEqual({
      status: 'ready',
      text: RU,
    });
    expect(translator.calls).toBe(1);
    expect((await store.find(KEY))?.attempts).toBe(2);
  });

  it('reclaims a row from an older revision and starts attempts over', async () => {
    const store = new FakeStore();
    const clock = fakeClock();
    const old = store.seed(KEY, {
      status: 'ready',
      sourceRevision: 2,
      leaseExpiresAt: null,
      retryAfter: null,
      attempts: 4,
      text: RU,
    });
    const translator = instantTranslator();

    const outcome = await resolveIssueTranslation(baseInput(store, translator, clock));

    expect(outcome).toEqual({ status: 'ready', text: RU });
    expect(translator.calls).toBe(1);
    expect(store.deletedIds).toEqual([old.id]);
    expect(await store.find(KEY)).toMatchObject({ sourceRevision: 3, attempts: 1 });
  });

  it('records a failure with a cooldown when the translator throws', async () => {
    const store = new FakeStore();
    const clock = fakeClock();
    const translator: IssueTranslator = {
      kind: 'stub',
      translate: async () => {
        throw new Error('gateway down');
      },
    };
    const { log, lines } = logRecorder();

    const outcome = await resolveIssueTranslation({ ...baseInput(store, translator, clock), log });

    expect(outcome).toEqual({ status: 'failed' });
    const row = await store.find(KEY);
    expect(row?.status).toBe('failed');
    expect(row?.retryAfter?.getTime()).toBe(clock.now() + TRANSLATION_RETRY_AFTER_MS);
    expect(lines).toContainEqual([
      'issue translation failed',
      expect.objectContaining({ error: 'gateway down' }),
    ]);
  });

  it('treats a translation with the wrong shape as a failure', async () => {
    const store = new FakeStore();
    const translator = instantTranslator({ ...RU, summaryPoints: RU.summaryPoints.slice(1) });

    const outcome = await resolveIssueTranslation(baseInput(store, translator, fakeClock()));

    expect(outcome).toEqual({ status: 'failed' });
    expect((await store.find(KEY))?.status).toBe('failed');
  });

  it('discards the result when an edit deleted the claimed row meanwhile', async () => {
    const store = new FakeStore();
    const clock = fakeClock();
    const translator = controlledTranslator();
    const kept: Array<Promise<unknown>> = [];
    const { log, lines } = logRecorder();

    const outcome = await resolveIssueTranslation({
      ...baseInput(store, translator, clock, kept),
      log,
    });
    expect(outcome).toEqual({ status: 'pending' });
    store.rows.clear();
    translator.resolveNext();

    await Promise.all(kept);
    expect(store.rows.size).toBe(0);
    expect(lines.map(([message]) => message)).toContain(
      'issue translation discarded: row invalidated',
    );
  });

  it('rethrows a claim error when no competing row exists', async () => {
    const store = new FakeStore();
    store.create = async () => {
      throw new Error('connection reset');
    };

    await expect(
      resolveIssueTranslation(baseInput(store, instantTranslator(), fakeClock())),
    ).rejects.toThrow('connection reset');
  });
});
