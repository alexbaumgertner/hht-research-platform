import { candidateId, type Candidate } from '../adapters/types.js';

/** Persisted per source while a backlog is being drained (spec 004, G1). */
export type CursorState = {
  /** Cursor key of the boundary day/instant whose candidates may be only partly processed. */
  boundaryKey: string;
  /** Ids already handled on the boundary key; excluded before the batch limit is applied. */
  processedIds: string[];
  /** Consecutive runs that ended with candidates left over (drives the backlog ERROR log). */
  overflowRuns: number;
};

export type WatermarkDecision =
  | { kind: 'startedAt' } // nothing left over: advance to the run start (previous behaviour)
  | { kind: 'at'; iso: string }; // overflow: stop at the newest processed cursor key

export type BatchSelection = {
  batch: Candidate[];
  /** Candidates returned beyond the batch (lower bound: adapters fetch batchSize + 1). */
  remainingCount: number;
  watermark: WatermarkDecision;
  /** null clears any stored state. */
  cursorState: CursorState | null;
};

export const BACKLOG_ERROR_AFTER_RUNS = 3;

const DAY_KEY = /^\d{4}-\d{2}-\d{2}$/;

export function cursorKeyToIso(key: string): string {
  return DAY_KEY.test(key) ? `${key}T00:00:00.000Z` : new Date(key).toISOString();
}

/**
 * Picks this run's batch without assuming adapter ordering: dated candidates are sorted by their
 * query-native cursor key ascending, undated ones follow. On overflow the watermark stops at the
 * newest processed key, and ids already handled on that key are remembered so the next run makes
 * progress even when many candidates share one day.
 */
export function selectBatch(
  candidates: Candidate[],
  batchSize: number,
  prev?: CursorState | null,
): BatchSelection {
  const size = Math.max(0, batchSize);
  const done = new Set(prev?.processedIds ?? []);
  const fresh = candidates.filter((c) => {
    const id = candidateId(c);
    return !(id && c.cursorKey === prev?.boundaryKey && done.has(id));
  });
  const dated = fresh
    .filter((c) => c.cursorKey)
    .sort((a, b) => (a.cursorKey! < b.cursorKey! ? -1 : a.cursorKey! > b.cursorKey! ? 1 : 0));
  const ordered = [...dated, ...fresh.filter((c) => !c.cursorKey)];

  if (ordered.length <= size) {
    return {
      batch: ordered,
      remainingCount: 0,
      watermark: { kind: 'startedAt' },
      cursorState: null,
    };
  }

  const batch = ordered.slice(0, size);
  const overflowRuns = (prev?.overflowRuns ?? 0) + 1;
  const datedInBatch = batch.filter((c) => c.cursorKey);
  const base = { batch, remainingCount: ordered.length - size };

  if (dated.length <= size) {
    // Every dated candidate is in the batch; only undated ones are left. Undated items are not
    // tied to the watermark (they are re-seen in the feed), so it only ever moves forward.
    return {
      ...base,
      watermark: { kind: 'startedAt' },
      cursorState: { boundaryKey: '', processedIds: [], overflowRuns },
    };
  }
  const boundaryKey = datedInBatch[datedInBatch.length - 1]!.cursorKey!;
  const processedIds = new Set(prev?.boundaryKey === boundaryKey ? prev.processedIds : []);
  for (const c of datedInBatch) {
    const id = candidateId(c);
    if (c.cursorKey === boundaryKey && id) processedIds.add(id);
  }
  return {
    ...base,
    watermark: { kind: 'at', iso: cursorKeyToIso(boundaryKey) },
    cursorState: { boundaryKey, processedIds: [...processedIds], overflowRuns },
  };
}
