import type { Candidate, SourceAdapter } from '../adapters/types.js';
import type { CmsClient } from '../cms/client.js';
import { checkProject, type ProjectForCheck } from './checkProject.js';

const errors: string[] = [];
const realError = console.error;
const realLog = console.log;

beforeAll(() => {
  console.error = (line: unknown) => {
    errors.push(String(line));
  };
  console.log = () => {};
});
afterAll(() => {
  console.error = realError;
  console.log = realLog;
});

function setup(adapterBehaviour: (type: string) => Promise<Candidate[]>) {
  const checked: Array<{ id: string; at: string }> = [];
  const calls: Array<{ type: string; limit: number; since: Date | null }> = [];
  const cms = {
    batchSize: 50,
    patchProjectChecked: async (id: string, at: string) => {
      checked.push({ id, at });
    },
  } as unknown as CmsClient;
  const adapter = (type: string): SourceAdapter => ({
    async fetchCandidates(input) {
      calls.push({ type, limit: input.limit, since: input.since });
      return adapterBehaviour(type);
    },
  });
  const project: ProjectForCheck = {
    id: 'p1',
    slug: 'p',
    keywords: ['k'],
    lastSuccessfulRunAt: '2026-11-16T04:00:00.000Z',
    bootstrapLookbackDays: 30,
    sources: [
      {
        id: 's1',
        type: 'pubmed',
        enabled: true,
        lastSuccessfulFetchAt: '2026-11-16T04:00:00.000Z',
      },
      { id: 's2', type: 'clinicaltrials', enabled: true, lastSuccessfulFetchAt: null },
      { id: 's3', type: 'rss', enabled: false },
    ],
  };
  const deps = {
    adapters: {
      pubmed: adapter('pubmed'),
      clinicaltrials: adapter('clinicaltrials'),
      rss: adapter('rss'),
    },
  };
  return { cms, project, deps, checked, calls };
}

describe('checkProject (daily lightweight check)', () => {
  it('fetches each enabled source with a minimal limit and records lastCheckedAt', async () => {
    const h = setup(async () => []);
    const ok = await checkProject(h.cms, h.project, h.deps);
    expect(ok).toBe(true);
    expect(h.calls.map((c) => c.type)).toEqual(['pubmed', 'clinicaltrials']);
    expect(h.calls.every((c) => c.limit === 1)).toBe(true);
    expect(h.checked).toHaveLength(1);
    expect(h.checked[0]!.id).toBe('p1');
  });

  it('does not write watermarks, publications or run records (cms has no such methods)', async () => {
    const h = setup(async () => [
      { externalIds: { pmid: '1' }, title: 't', originalUrl: 'u', sourceType: 'pubmed' },
    ]);
    // Any other cms call would throw (the stub only has patchProjectChecked and batchSize).
    await expect(checkProject(h.cms, h.project, h.deps)).resolves.toBe(true);
  });

  it('a failing source logs ERROR and does not record the check', async () => {
    errors.length = 0;
    const h = setup(async (type) => {
      if (type === 'clinicaltrials') throw new Error('503');
      return [];
    });
    const ok = await checkProject(h.cms, h.project, h.deps);
    expect(ok).toBe(false);
    expect(h.checked).toHaveLength(0);
    expect(errors.some((e) => e.includes('source check failed'))).toBe(true);
  });
});
