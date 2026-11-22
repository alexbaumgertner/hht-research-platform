import type { Candidate } from '../adapters/types.js';
import { candidateId } from '../adapters/types.js';
import { cursorKeyToIso, selectBatch, type CursorState, type WatermarkDecision } from './cursor.js';

function cand(id: string, cursorKey?: string, displayDate?: Date): Candidate {
  return {
    externalIds: { pmid: id },
    title: `t${id}`,
    originalUrl: `https://x/${id}`,
    sourceType: 'pubmed',
    ...(cursorKey ? { cursorKey } : {}),
    ...(displayDate ? { publishedOrUpdatedAt: displayDate } : {}),
  };
}

/** Day-precision source: returns everything >= since (day), minus excluded ids, in shuffled order. */
function stubSource(all: Candidate[]) {
  return (since: string | null, excludeIds: string[] = []) =>
    all
      .filter((c) => !since || c.cursorKey! >= since.slice(0, 10))
      .filter((c) => !excludeIds.includes(candidateId(c)!))
      .reverse(); // adapters do not guarantee order
}

describe('selectBatch', () => {
  it('keeps the previous behaviour when nothing overflows', () => {
    const sel = selectBatch([cand('1', '2026-11-01'), cand('2', '2026-11-02')], 5);
    expect(sel.batch).toHaveLength(2);
    expect(sel.remainingCount).toBe(0);
    expect(sel.watermark).toEqual({ kind: 'startedAt' });
    expect(sel.cursorState).toBeNull();
  });

  it('zero items is a clean no-op', () => {
    const sel = selectBatch([], 3);
    expect(sel).toMatchObject({ batch: [], remainingCount: 0, watermark: { kind: 'startedAt' } });
  });

  it('processes oldest first and stops the watermark at the newest processed key', () => {
    const all = [
      cand('5', '2026-11-05'),
      cand('1', '2026-11-01'),
      cand('3', '2026-11-03'),
      cand('2', '2026-11-02'),
    ];
    const sel = selectBatch(all, 2);
    expect(sel.batch.map(candidateId)).toEqual(['1', '2']);
    expect(sel.remainingCount).toBe(2);
    expect(sel.watermark).toEqual({ kind: 'at', iso: '2026-11-02T00:00:00.000Z' });
    expect(sel.cursorState).toEqual({
      boundaryKey: '2026-11-02',
      processedIds: ['2'],
      overflowRuns: 1,
    });
  });

  it('uses the query key, not the display date (future journal date)', () => {
    const future = new Date('2027-03-01T00:00:00Z');
    const sel = selectBatch(
      [cand('a', '2026-11-03', future), cand('b', '2026-11-01', future), cand('c', '2026-11-02')],
      2,
    );
    expect(sel.batch.map(candidateId)).toEqual(['b', 'c']);
    expect(sel.watermark).toEqual({ kind: 'at', iso: '2026-11-02T00:00:00.000Z' });
  });

  it('drops ids already processed on the boundary key before limiting', () => {
    const prev: CursorState = { boundaryKey: '2026-11-02', processedIds: ['2'], overflowRuns: 1 };
    const sel = selectBatch([cand('2', '2026-11-02'), cand('3', '2026-11-02')], 1, prev);
    expect(sel.batch.map(candidateId)).toEqual(['3']);
    expect(sel.cursorState).toBeNull();
  });

  it('handles undated items: processed, never moves the watermark backwards', () => {
    const undated = (id: string): Candidate => cand(id);
    const sel = selectBatch([undated('u1'), undated('u2'), undated('u3')], 2);
    expect(sel.batch).toHaveLength(2);
    expect(sel.watermark).toEqual({ kind: 'startedAt' });
    expect(sel.remainingCount).toBe(1);
    const withDated = selectBatch([cand('d', '2026-11-01'), undated('u1'), undated('u2')], 2);
    expect(withDated.batch.map(candidateId)).toEqual(['d', 'u1']);
    expect(withDated.watermark).toEqual({ kind: 'startedAt' });
    expect(withDated.remainingCount).toBe(1);
  });

  it('cursorKeyToIso handles day and instant keys', () => {
    expect(cursorKeyToIso('2026-11-02')).toBe('2026-11-02T00:00:00.000Z');
    expect(cursorKeyToIso('2026-11-02T10:00:00Z')).toBe('2026-11-02T10:00:00.000Z');
  });
});

describe('multi-run drain (SC-001)', () => {
  function drain(all: Candidate[], batchSize: number) {
    const source = stubSource(all);
    const processed: string[] = [];
    let since: string | null = null;
    let state: CursorState | null = null;
    let runs = 0;
    for (; runs < 50; runs += 1) {
      const fetched = source(since, state?.processedIds).slice(); // limit applied by selectBatch
      const sel = selectBatch(fetched, batchSize, state);
      // no run may move the watermark past an unprocessed candidate
      const wm: WatermarkDecision = sel.watermark;
      if (wm.kind === 'at') {
        const unprocessed = fetched.filter((c) => !sel.batch.includes(c));
        for (const c of unprocessed) expect(c.cursorKey! >= wm.iso.slice(0, 10)).toBe(true);
        since = wm.iso;
      }
      processed.push(...sel.batch.map((c) => candidateId(c)!));
      state = sel.cursorState;
      if (wm.kind === 'startedAt') {
        runs += 1;
        break;
      }
    }
    return { processed, runs };
  }

  it('drains batchSize + N spread over days within ceil((size + N) / size) runs', () => {
    const all = Array.from({ length: 13 }, (_, i) => cand(String(i), `2026-11-${10 + (i % 4)}`));
    const { processed, runs } = drain(all, 3);
    expect(new Set(processed).size).toBe(13);
    expect(processed).toHaveLength(13);
    expect(runs).toBeLessThanOrEqual(Math.ceil(13 / 3) + 1);
  });

  it('drains 3 x batchSize sharing a single boundary day without repeating', () => {
    const all = Array.from({ length: 9 }, (_, i) => cand(String(i), '2026-11-10'));
    const { processed } = drain(all, 3);
    expect(processed).toHaveLength(9);
    expect(new Set(processed).size).toBe(9);
  });

  it('counts consecutive overflow runs in the cursor state', () => {
    const all = Array.from({ length: 9 }, (_, i) => cand(String(i), '2026-11-10'));
    let state: CursorState | null = null;
    const runs: number[] = [];
    for (let i = 0; i < 3; i += 1) {
      const sel = selectBatch(stubSource(all)('2026-11-10', state?.processedIds), 2, state);
      state = sel.cursorState;
      runs.push(state?.overflowRuns ?? 0);
    }
    expect(runs).toEqual([1, 2, 3]);
  });
});
