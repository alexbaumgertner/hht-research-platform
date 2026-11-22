import type { Candidate, SourceAdapter } from '../adapters/types.js';
import { candidateId } from '../adapters/types.js';
import type { CmsClient } from '../cms/client.js';
import type { CursorState } from './cursor.js';
import { runProject, type ProjectForRun, type RunProjectDeps } from './runProject.js';

const BATCH = 3;

function cand(id: string, key?: string, display?: Date): Candidate {
  return {
    externalIds: { pmid: id },
    title: `Paper ${id}`,
    originalUrl: `https://x/${id}`,
    sourceType: 'pubmed',
    publishedOrUpdatedAt: display,
    ...(key ? { cursorKey: key } : {}),
  };
}

/** In-memory CMS + day-precision source honouring excludeIds and the adapter contract (oldest `limit`). */
function harness(all: Candidate[], opts: { failOnPmid?: string } = {}) {
  const stored = new Set<string>();
  const source = {
    id: 's1',
    type: 'pubmed' as const,
    enabled: true,
    lastSuccessfulFetchAt: null as string | null,
    cursorState: null as CursorState | null,
  };
  const project: ProjectForRun = {
    id: 'p1',
    name: 'P',
    slug: 'p',
    keywords: ['k'],
    lastSuccessfulRunAt: null,
    bootstrapLookbackDays: 30,
    emailNotificationEnabled: false,
    sources: [source],
  };
  type RunPatch = {
    sourceResults: Array<{ status: string; remainingCount: number; acceptedCount: number }>;
  };
  const runs: RunPatch[] = [];
  const patches: Array<{ at: string; cursorState: CursorState | null }> = [];
  const cms = {
    batchSize: BATCH,
    createRun: async () => ({ doc: { id: `r${runs.length + 1}` } }),
    findPublicationByDedupe: async (_p: unknown, key: string) =>
      stored.has(key) ? { id: key } : null,
    createPublication: async (data: { dedupeKey: string; externalIds: { pmid: string } }) => {
      if (opts.failOnPmid === data.externalIds.pmid) throw new Error('db down');
      stored.add(data.dedupeKey);
      return { doc: { id: data.dedupeKey } };
    },
    updatePublication: async () => ({}),
    createDigest: async () => ({ doc: { id: 'd1' } }),
    createContentTranslation: async () => ({}),
    updateRun: async (_id: string, data: RunPatch) => {
      runs.push(data);
    },
    patchProjectWatermark: async () => ({}),
    patchSourceWatermark: async (_id: string, at: string, cursorState: CursorState | null) => {
      patches.push({ at, cursorState });
      source.lastSuccessfulFetchAt = at;
      source.cursorState = cursorState;
    },
  } as unknown as CmsClient;

  const adapter: SourceAdapter = {
    async fetchCandidates(input) {
      const since = input.since?.toISOString().slice(0, 10) ?? '0000';
      const ex = new Set(input.excludeIds ?? []);
      return all
        .filter((c) => c.cursorKey! >= since && !ex.has(candidateId(c)!))
        .sort((a, b) => (a.cursorKey! < b.cursorKey! ? -1 : a.cursorKey! > b.cursorKey! ? 1 : 0))
        .slice(0, input.limit) // adapter contract: the oldest `limit` candidates
        .reverse(); // ...returned in arbitrary order
    },
  };
  const deps: RunProjectDeps = {
    adapters: { pubmed: adapter, clinicaltrials: adapter, rss: adapter },
    classifyRelevance: async () => true,
    summarizeAndRank: (async () => ({
      importance: 'medium',
      summary: {},
    })) as unknown as NonNullable<RunProjectDeps['summarizeAndRank']>,
  };
  return { cms, project, source, deps, stored, runs, patches };
}

const errors: string[] = [];
const realError = console.error;
const realLog = console.log;

beforeAll(() => {
  process.env.TRANSLATE_ON_PUBLISH = '0';
  console.error = (line: unknown) => {
    errors.push(String(line));
  };
  console.log = () => {};
});

afterAll(() => {
  console.error = realError;
  console.log = realLog;
});

describe('runProject backlog handling (spec 004 G1)', () => {
  it('drains batchSize + 10 candidates across runs with nothing lost and no premature watermark', async () => {
    const all = Array.from({ length: BATCH + 10 }, (_, i) =>
      cand(String(i), `2026-11-${String(1 + (i % 5)).padStart(2, '0')}`, new Date('2027-05-01')),
    );
    const h = harness(all);
    const maxRuns = Math.ceil((BATCH + 10) / BATCH) + 1;
    let runs = 0;
    while (h.stored.size < all.length && runs < maxRuns) {
      await runProject(h.cms, h.project, 'schedule', h.deps);
      runs += 1;
      const last = h.runs[h.runs.length - 1]!;
      const remaining = last.sourceResults[0]!.remainingCount;
      if (remaining > 0) {
        // watermark is at a processed key, never beyond an unprocessed candidate
        const wm = h.source.lastSuccessfulFetchAt!.slice(0, 10);
        const unprocessed = all.filter((c) => !h.stored.has(`pmid:${c.externalIds.pmid}`));
        for (const c of unprocessed) expect(c.cursorKey! >= wm).toBe(true);
      }
    }
    expect(h.stored.size).toBe(all.length);
    expect(runs).toBeLessThanOrEqual(maxRuns);
  });

  it('drains 3 x batchSize on one boundary day, then clears the cursor state', async () => {
    const all = Array.from({ length: BATCH * 3 }, (_, i) => cand(String(i), '2026-11-10'));
    const h = harness(all);
    for (let i = 0; i < 4 && h.stored.size < all.length; i += 1) {
      await runProject(h.cms, h.project, 'schedule', h.deps);
    }
    expect(h.stored.size).toBe(all.length);
    await runProject(h.cms, h.project, 'schedule', h.deps);
    expect(h.source.cursorState).toBeNull();
    const last = h.runs[h.runs.length - 1]!;
    expect(last.sourceResults[0]!.remainingCount).toBe(0);
  });

  it('records remainingCount on the run and creates no duplicates', async () => {
    const all = Array.from({ length: BATCH + 2 }, (_, i) => cand(String(i), '2026-11-10'));
    const h = harness(all);
    await runProject(h.cms, h.project, 'schedule', h.deps);
    expect(h.runs[0]!.sourceResults[0]!).toMatchObject({
      status: 'success',
      acceptedCount: BATCH,
      remainingCount: 1, // lower bound: adapters fetch batchSize + 1
    });
    await runProject(h.cms, h.project, 'schedule', h.deps);
    expect(h.stored.size).toBe(BATCH + 2);
    expect(h.runs[1]!.sourceResults[0]!.remainingCount).toBe(0);
  });

  it('zero items: advances the watermark to the run start with no cursor state', async () => {
    const h = harness([]);
    await runProject(h.cms, h.project, 'schedule', h.deps);
    expect(h.patches).toHaveLength(1);
    expect(h.patches[0]!.cursorState).toBeNull();
    expect(h.runs[0]!.sourceResults[0]!.remainingCount).toBe(0);
  });

  it('mid-batch failure keeps the watermark and cursor state untouched (FR-002)', async () => {
    const all = Array.from({ length: BATCH + 2 }, (_, i) => cand(String(i), '2026-11-10'));
    const h = harness(all, { failOnPmid: '3' });
    await runProject(h.cms, h.project, 'schedule', h.deps);
    expect(h.patches).toHaveLength(0);
    expect(h.runs[0]!.sourceResults[0]!.status).toBe('failure');
  });

  it('logs an ERROR when a backlog persists for 3 consecutive runs (T005)', async () => {
    const all = Array.from({ length: 12 }, (_, i) => cand(String(i), '2026-11-10'));
    const h = harness(all);
    errors.length = 0;
    for (let i = 0; i < 3; i += 1) await runProject(h.cms, h.project, 'schedule', h.deps);
    expect(errors.filter((m) => m.includes('source backlog persists'))).toHaveLength(1);
  });
});
