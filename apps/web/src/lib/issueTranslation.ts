import type { IssueText, IssueTranslationLocale, IssueTranslator } from '@/lib/issueTranslator';

export const ISSUE_TRANSLATION_WAIT_MS = 8_000;
export const TRANSLATION_POLL_MS = 400;
export const TRANSLATION_LEASE_MS = 120_000;
export const TRANSLATION_RETRY_AFTER_MS = 15 * 60_000;
const MAX_ERROR_CHARS = 300;

export type TranslationKey = { digestId: string; locale: IssueTranslationLocale };

export type TranslationRow = {
  id: string;
  status: 'pending' | 'ready' | 'failed';
  sourceRevision: number;
  leaseExpiresAt: Date | null;
  retryAfter: Date | null;
  attempts: number;
  text: IssueText | null;
};

export type TranslationClaim = {
  sourceRevision: number;
  leaseExpiresAt: Date;
  attempts: number;
};

export type TranslationFinish =
  { status: 'ready'; text: IssueText } | { status: 'failed'; retryAfter: Date; error: string };

/**
 * The `issue-translations` collection. `create` must reject a second row for the
 * same key (the unique index); that rejection is the single-flight lock.
 */
export interface TranslationStore {
  find(key: TranslationKey): Promise<TranslationRow | null>;
  create(key: TranslationKey, claim: TranslationClaim): Promise<TranslationRow>;
  deleteById(id: string): Promise<void>;
  /** `false` when the row no longer exists (invalidated by an edit). */
  finish(id: string, result: TranslationFinish): Promise<boolean>;
}

export type TranslationOutcome =
  { status: 'ready'; text: IssueText } | { status: 'pending' } | { status: 'failed' };

export type RowDecision = 'serve' | 'wait' | 'cooldown' | 'reclaim';

export function decideRow(row: TranslationRow, revision: number, now: number): RowDecision {
  if (row.sourceRevision !== revision) return 'reclaim';
  if (row.status === 'ready') return row.text ? 'serve' : 'reclaim';
  if (row.status === 'pending') {
    return row.leaseExpiresAt && row.leaseExpiresAt.getTime() > now ? 'wait' : 'reclaim';
  }
  return row.retryAfter && row.retryAfter.getTime() > now ? 'cooldown' : 'reclaim';
}

/** Throws unless `translated` covers every English point and sentence, in the same shape. */
export function assertTranslationMatches(source: IssueText, translated: IssueText): void {
  if (translated.summaryPoints.length !== source.summaryPoints.length) {
    throw new Error('Translated summary point count does not match the English text');
  }
  if (translated.summaryPoints.some((point) => !point.trim())) {
    throw new Error('Translated summary point is empty');
  }
  const sentences = new Map(translated.itemSentences.map((row) => [row.publicationId, row]));
  for (const row of source.itemSentences) {
    if (!sentences.get(row.publicationId)?.sentence.trim()) {
      throw new Error(`Translated sentence missing for publication ${row.publicationId}`);
    }
  }
}

export type ResolveTranslationInput = {
  store: TranslationStore;
  translator: IssueTranslator;
  key: TranslationKey;
  /** The digest's current `issueTextRevision`. */
  revision: number;
  source: IssueText;
  /** Epoch ms after which the caller answers with English. */
  deadline: number;
  /** Keeps the owner's translation alive after the response (`after()` in the route). */
  keepAlive: (work: Promise<unknown>) => void;
  now?: () => number;
  sleep?: Sleep;
  log?: (message: string, context: Record<string, unknown>) => void;
};

type Sleep = (ms: number, signal?: AbortSignal) => Promise<void>;

const defaultSleep: Sleep = (ms, signal) =>
  new Promise<void>((resolve) => {
    const timer = setTimeout(resolve, ms);
    signal?.addEventListener('abort', () => {
      clearTimeout(timer);
      resolve();
    });
  });

/**
 * Serve, wait for, or claim-and-run the translation of one issue into one locale
 * (research R7/R8). At most one translator call runs per key until the text
 * revision changes or a failure cooldown expires, across any number of instances.
 */
export async function resolveIssueTranslation(
  input: ResolveTranslationInput,
): Promise<TranslationOutcome> {
  const { store, key, revision, deadline } = input;
  const now = input.now ?? Date.now;
  const sleep = input.sleep ?? defaultSleep;

  const existing = await store.find(key);
  let attempts = 1;

  if (existing) {
    switch (decideRow(existing, revision, now())) {
      case 'serve':
        return { status: 'ready', text: existing.text! };
      case 'cooldown':
        return { status: 'failed' };
      case 'wait':
        return waitForRow(input, now, sleep);
      case 'reclaim':
        if (existing.sourceRevision === revision) attempts = existing.attempts + 1;
        // By id: a slow reclaimer must never delete someone else's fresh claim.
        await store.deleteById(existing.id);
    }
  }

  let claimed: TranslationRow;
  try {
    claimed = await store.create(key, {
      sourceRevision: revision,
      leaseExpiresAt: new Date(now() + TRANSLATION_LEASE_MS),
      attempts,
    });
  } catch (error) {
    // The unique-violation error is not a stable type; a row on re-read means we lost the race.
    if (await store.find(key)) return waitForRow(input, now, sleep);
    throw error;
  }

  const work = runTranslation(input, claimed.id, now);
  input.keepAlive(work);

  const timeout = Symbol('timeout');
  const stopTimer = new AbortController();
  const result = await Promise.race([
    work,
    sleep(Math.max(0, deadline - now()), stopTimer.signal).then(() => timeout),
  ]);
  stopTimer.abort();
  return result === timeout ? { status: 'pending' } : (result as TranslationOutcome);
}

async function runTranslation(
  input: ResolveTranslationInput,
  rowId: string,
  now: () => number,
): Promise<TranslationOutcome> {
  const { store, translator, key, source } = input;
  try {
    const text = await translator.translate({
      digestId: key.digestId,
      locale: key.locale,
      text: source,
    });
    assertTranslationMatches(source, text);
    const stored = await store.finish(rowId, { status: 'ready', text });
    if (!stored) input.log?.('issue translation discarded: row invalidated', { ...key, rowId });
    return { status: 'ready', text };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    input.log?.('issue translation failed', { ...key, rowId, error: message });
    try {
      await store.finish(rowId, {
        status: 'failed',
        retryAfter: new Date(now() + TRANSLATION_RETRY_AFTER_MS),
        error: message.slice(0, MAX_ERROR_CHARS),
      });
    } catch (finishError) {
      input.log?.('issue translation failure not recorded', {
        ...key,
        rowId,
        error: finishError instanceof Error ? finishError.message : String(finishError),
      });
    }
    return { status: 'failed' };
  }
}

async function waitForRow(
  input: ResolveTranslationInput,
  now: () => number,
  sleep: Sleep,
): Promise<TranslationOutcome> {
  const { store, key, revision, deadline } = input;

  while (now() < deadline) {
    await sleep(Math.min(TRANSLATION_POLL_MS, Math.max(0, deadline - now())));
    const row = await store.find(key);
    if (!row || row.sourceRevision !== revision) continue;
    if (row.status === 'ready' && row.text) return { status: 'ready', text: row.text };
    if (row.status === 'failed') return { status: 'failed' };
  }

  return { status: 'pending' };
}
