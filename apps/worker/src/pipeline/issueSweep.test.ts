import {
  CmsClient,
  CmsHttpError,
  issueTextWorkQuery,
  type CmsId,
  type IssuePublicationDoc,
  type IssueTextWorkDigest,
} from '../cms/client.js';
import type { IssueText } from './issueText.js';
import {
  ISSUE_TEXT_ERROR_MAX_CHARS,
  isIssueTextWork,
  sweepIssueText,
  type IssueSweepCms,
  type IssueSweepDeps,
} from './issueSweep.js';

type LogLine = { severity: string; message: string } & Record<string, unknown>;

const NOW = new Date('2026-09-28T04:03:12.000Z');

function digest(overrides: Partial<IssueTextWorkDigest> & Pick<IssueTextWorkDigest, 'id'>) {
  return {
    project: 2,
    publications: [301, 305],
    issueTextStatus: 'pending',
    issueTextAttempts: 0,
    hiddenFromPublic: false,
    ...overrides,
  } satisfies IssueTextWorkDigest;
}

const generatedText: IssueText = {
  issueSummaryPoints: [{ text: 'A point.', items: [301] }],
  issueItemSentences: [
    { publication: 301, sentence: 'One.' },
    { publication: 305, sentence: 'Two.' },
  ],
};

class FakeCms implements IssueSweepCms {
  patches: Array<{ id: CmsId; data: Record<string, unknown> }> = [];
  projectLoads = 0;
  failPatchFor = new Set<CmsId>();

  constructor(private readonly work: IssueTextWorkDigest[] | Error) {}

  async listIssueTextWork() {
    if (this.work instanceof Error) throw this.work;
    return this.work;
  }

  async getProject(id: CmsId) {
    this.projectLoads += 1;
    return {
      id,
      name: 'Test project',
      slug: 'test-project',
      keywords: ['hht'],
      audienceContext: null,
    };
  }

  async listPublicationsForIssue(ids: CmsId[]): Promise<IssuePublicationDoc[]> {
    return ids.map((id) => ({ id, title: `Item ${id}`, sourceType: 'pubmed' }));
  }

  async patchDigest(id: CmsId, data: Record<string, unknown>) {
    if (this.failPatchFor.has(id)) throw new Error('patch rejected');
    this.patches.push({ id, data });
    return {};
  }
}

function sweepDeps(failFor: CmsId[] = []): IssueSweepDeps & { generatedFor: CmsId[][] } {
  const generatedFor: CmsId[][] = [];
  return {
    generatedFor,
    now: () => NOW,
    generate: async (_project, items) => {
      const ids = items.map((i) => i.id);
      generatedFor.push(ids);
      if (ids.some((id) => failFor.includes(id)))
        throw new Error('summary step failed validation twice');
      return generatedText;
    },
  };
}

describe('sweepIssueText', () => {
  const originalLog = console.log;
  const originalError = console.error;
  let logs: LogLine[];

  beforeEach(() => {
    logs = [];
    const capture = (line: unknown) => logs.push(JSON.parse(String(line)) as LogLine);
    console.log = capture;
    console.error = capture;
  });

  afterEach(() => {
    console.log = originalLog;
    console.error = originalError;
  });

  const errors = () => logs.filter((l) => l.severity === 'ERROR');

  describe('selection', () => {
    it('asks for pending, unset, or failed with fewer than 3 attempts, oldest first, 20 at a time', () => {
      const query = Object.fromEntries(issueTextWorkQuery());
      expect(query).toEqual({
        depth: '0',
        limit: '20',
        sort: 'publishedAt',
        'where[or][0][issueTextStatus][equals]': 'pending',
        'where[or][1][issueTextStatus][exists]': 'false',
        'where[or][2][and][0][issueTextStatus][equals]': 'failed',
        'where[or][2][and][1][issueTextAttempts][less_than]': '3',
      });
    });

    it.each([
      [null, 0, true],
      ['pending', 0, true],
      ['failed', 2, true],
      ['failed', 3, false],
      ['ready', 0, false],
    ] as const)('status %p with %p attempts → eligible %p', (status, attempts, eligible) => {
      expect(isIssueTextWork({ issueTextStatus: status, issueTextAttempts: attempts })).toBe(
        eligible,
      );
    });

    it('includes hidden digests and skips capped failures even if the CMS returns them', async () => {
      const cms = new FakeCms([
        digest({ id: 1, hiddenFromPublic: true }),
        digest({ id: 2, issueTextStatus: 'failed', issueTextAttempts: 3 }),
        digest({ id: 3, issueTextStatus: null }),
      ]);

      const result = await sweepIssueText(cms, sweepDeps());

      expect(cms.patches.map((p) => p.id)).toEqual([1, 3]);
      expect(result).toEqual({ selected: 2, generated: 2, failed: 0 });
      expect(logs.find((l) => l.message === '[worker] sweep start')).toMatchObject({
        pending: 2,
        failedRetryable: 0,
      });
    });
  });

  describe('writes', () => {
    it('PATCHes generated text as ready with ids exactly as REST returned them', async () => {
      const cms = new FakeCms([digest({ id: 7 })]);
      await sweepIssueText(cms, sweepDeps());

      expect(cms.patches).toEqual([
        {
          id: 7,
          data: {
            issueSummaryPoints: [{ text: 'A point.', items: [301] }],
            issueItemSentences: [
              { publication: 301, sentence: 'One.' },
              { publication: 305, sentence: 'Two.' },
            ],
            issueTextStatus: 'ready',
            issueTextSource: 'generated',
            issueTextGeneratedAt: '2026-09-28T04:03:12.000Z',
            issueTextError: null,
          },
        },
      ]);
      expect(logs.find((l) => l.message === '[worker] issue text generated')).toMatchObject({
        digestId: 7,
        projectSlug: 'test-project',
        points: 1,
        items: 2,
      });
    });

    it('PATCHes a failure with attempts + 1 and a short error, logged at ERROR', async () => {
      const cms = new FakeCms([digest({ id: 8, issueTextStatus: 'failed', issueTextAttempts: 1 })]);
      await sweepIssueText(cms, sweepDeps([301]));

      expect(cms.patches).toEqual([
        {
          id: 8,
          data: {
            issueTextStatus: 'failed',
            issueTextAttempts: 2,
            issueTextError: 'summary step failed validation twice',
          },
        },
      ]);
      expect(errors()).toEqual([
        expect.objectContaining({
          message: '[worker] issue text generation failed',
          digestId: 8,
          projectSlug: 'test-project',
          attempt: 2,
        }),
      ]);
    });

    it('caps the stored error at 300 characters', async () => {
      const cms = new FakeCms([digest({ id: 9 })]);
      await sweepIssueText(cms, {
        now: () => NOW,
        generate: async () => {
          throw new Error('x'.repeat(1000));
        },
      });
      expect(String(cms.patches[0]?.data.issueTextError)).toHaveLength(ISSUE_TEXT_ERROR_MAX_CHARS);
    });
  });

  describe('isolation', () => {
    it('keeps going after one digest fails', async () => {
      const cms = new FakeCms([
        digest({ id: 1, publications: [301] }),
        digest({ id: 2, publications: [305] }),
      ]);
      const result = await sweepIssueText(cms, sweepDeps([301]));

      expect(result).toEqual({ selected: 2, generated: 1, failed: 1 });
      expect(cms.patches.map((p) => [p.id, p.data.issueTextStatus])).toEqual([
        [1, 'failed'],
        [2, 'ready'],
      ]);
    });

    it('keeps going when recording a failure is itself rejected', async () => {
      const cms = new FakeCms([
        digest({ id: 1, publications: [301] }),
        digest({ id: 2, publications: [305] }),
      ]);
      cms.failPatchFor.add(1);
      const result = await sweepIssueText(cms, sweepDeps([301]));

      expect(result.generated).toBe(1);
      expect(cms.patches.map((p) => p.id)).toEqual([2]);
      expect(errors().map((l) => l.message)).toEqual([
        '[worker] issue text generation failed',
        '[worker] issue text failure not recorded',
      ]);
    });

    it('loads each project once per sweep', async () => {
      const cms = new FakeCms([
        digest({ id: 1 }),
        digest({ id: 2 }),
        digest({ id: 3, project: 4 }),
      ]);
      await sweepIssueText(cms, sweepDeps());
      expect(cms.projectLoads).toBe(2);
    });
  });

  describe('selection query failures', () => {
    it('logs WARN, not ERROR, and PATCHes nothing when the CMS rejects the query (400)', async () => {
      const cms = new FakeCms(new CmsHttpError('CMS GET /api/digests failed: 400', 400));
      const deps = sweepDeps();
      const result = await sweepIssueText(cms, deps);

      expect(result.skipped).toBe('cms-rejected-query');
      expect(deps.generatedFor).toEqual([]);
      expect(cms.patches).toEqual([]);
      expect(errors()).toEqual([]);
      expect(logs).toEqual([
        expect.objectContaining({
          severity: 'WARNING',
          message: '[worker] sweep skipped: cms rejected query',
          status: 400,
        }),
      ]);
    });

    it.each([
      ['a 5xx', new CmsHttpError('CMS GET /api/digests failed: 503', 503)],
      ['a rejected API key (403)', new CmsHttpError('CMS GET /api/digests failed: 403', 403)],
      ['a network error', new TypeError('fetch failed')],
    ])('logs ERROR "sweep list failed" on %s', async (_label, err) => {
      const result = await sweepIssueText(new FakeCms(err), sweepDeps());

      expect(result.skipped).toBe('cms-unreachable');
      expect(errors()).toEqual([
        expect.objectContaining({ message: '[worker] sweep list failed' }),
      ]);
    });

    it('classifies a real CmsClient 400 response as a rejected query', async () => {
      const originalFetch = global.fetch;
      global.fetch = async () => new Response('{"errors":[]}', { status: 400 });
      try {
        const result = await sweepIssueText(new CmsClient('https://cms.test', 'key'), sweepDeps());
        expect(result.skipped).toBe('cms-rejected-query');
      } finally {
        global.fetch = originalFetch;
      }
    });
  });
});
