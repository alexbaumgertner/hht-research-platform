import {
  applyIssueTextRules,
  assertDigestHasPublications,
  capCreateDepth,
  invalidateIssueTranslations,
  issueTextFingerprint,
  resolveRelationshipId,
  stampFeedPublishedAt,
  validateRefsWithinDigest,
  type IssueTextDoc,
} from './digestHooks';

describe('resolveRelationshipId', () => {
  it('returns a raw id', () => {
    expect(resolveRelationshipId(12)).toBe(12);
    expect(resolveRelationshipId('abc')).toBe('abc');
  });

  it('unwraps a populated relationship object', () => {
    expect(resolveRelationshipId({ id: 7, name: 'HHT' })).toBe(7);
  });

  it('returns undefined for missing values', () => {
    expect(resolveRelationshipId(null)).toBeUndefined();
    expect(resolveRelationshipId(undefined)).toBeUndefined();
    expect(resolveRelationshipId({})).toBeUndefined();
  });
});

describe('capCreateDepth', () => {
  it('forces depth 0 on create even when the client omitted it', () => {
    expect(capCreateDepth({}, 'create')).toEqual({ depth: 0 });
    expect(capCreateDepth({ depth: 2 }, 'create')).toEqual({ depth: 0 });
  });

  it('leaves depth unchanged for update/delete', () => {
    expect(capCreateDepth({ depth: 2 }, 'update')).toEqual({ depth: 2 });
    expect(capCreateDepth({ depth: 2 }, 'delete')).toEqual({ depth: 2 });
  });
});

describe('stampFeedPublishedAt', () => {
  function makeReq() {
    const calls: Array<Record<string, unknown>> = [];
    const updateOne = async (args: Record<string, unknown>) => {
      calls.push(args);
    };
    return {
      req: { payload: { db: { updateOne } } } as unknown as Parameters<
        typeof stampFeedPublishedAt
      >[1],
      calls,
    };
  }

  it('stamps each publication id (raw and populated)', async () => {
    const { req, calls } = makeReq();
    await stampFeedPublishedAt(
      {
        publishedAt: '2026-08-30T12:00:00.000Z',
        publications: [1, { id: 'abc' }, null, {}],
      },
      req,
    );
    expect(calls).toHaveLength(2);
    expect(calls[0]).toMatchObject({
      collection: 'publications',
      id: 1,
      data: { feedPublishedAt: '2026-08-30T12:00:00.000Z' },
      returning: false,
    });
    expect(calls[1]).toMatchObject({
      collection: 'publications',
      id: 'abc',
      data: { feedPublishedAt: '2026-08-30T12:00:00.000Z' },
      returning: false,
    });
  });

  it('is a no-op when publishedAt is unset', async () => {
    const { req, calls } = makeReq();
    await stampFeedPublishedAt({ publications: [1, 2] }, req);
    expect(calls).toHaveLength(0);
  });

  it('is a no-op when publications is empty', async () => {
    const { req, calls } = makeReq();
    await stampFeedPublishedAt({ publishedAt: '2026-08-30T12:00:00.000Z', publications: [] }, req);
    expect(calls).toHaveLength(0);
  });
});

describe('assertDigestHasPublications', () => {
  it('rejects an empty digest on create', () => {
    expect(() => assertDigestHasPublications({ publications: [] }, 'create')).toThrow(
      'Cannot publish an empty digest',
    );
    expect(() => assertDigestHasPublications({}, 'create')).toThrow();
  });

  it('lets an update that omits publications through (worker issue-text PATCH)', () => {
    expect(() => assertDigestHasPublications({ issueTextStatus: 'ready' }, 'update')).not.toThrow();
  });

  it('still rejects an update that empties publications', () => {
    expect(() => assertDigestHasPublications({ publications: [] }, 'update')).toThrow();
    expect(() => assertDigestHasPublications({ publications: null }, 'update')).toThrow();
  });
});

describe('validateRefsWithinDigest', () => {
  const data = { publications: [1, { id: 2 }] };

  it('accepts references to the digest publications', () => {
    expect(validateRefsWithinDigest([1, 2], data)).toBe(true);
    expect(validateRefsWithinDigest({ id: 2 }, data)).toBe(true);
    expect(validateRefsWithinDigest(null, data)).toBe(true);
  });

  it('rejects a publication that is not in the digest', () => {
    expect(validateRefsWithinDigest([1, 3], data)).toMatch(/3/);
    expect(validateRefsWithinDigest(3, data)).toMatch(/not in this digest/);
  });
});

const API_KEY = 'test-worker-key';

function headers(key?: string) {
  const h = new Headers();
  if (key) h.set('X-Payload-API-Key', key);
  return h;
}

const adminReq = { user: { id: 1, roles: ['admin'] }, headers: headers() };
const workerRoleReq = { user: { id: 2, roles: ['worker'] }, headers: headers() };
const headerKeyReq = { user: null, headers: headers(API_KEY) };

function readyDoc(overrides: Partial<IssueTextDoc> = {}): IssueTextDoc {
  return {
    issueSummaryPoints: [{ text: 'Point one.', items: [1, 2] }],
    issueItemSentences: [
      { publication: 1, sentence: 'First sentence.' },
      { publication: 2, sentence: 'Second sentence.' },
    ],
    issueTextStatus: 'ready',
    issueTextAttempts: 0,
    issueTextError: null,
    issueTextSource: 'generated',
    issueTextRevision: 2,
    ...overrides,
  };
}

describe('issueTextFingerprint', () => {
  it('ignores row ids, item order within a point, and sentence order', () => {
    const a = readyDoc();
    const b = readyDoc({
      issueSummaryPoints: [{ text: ' Point one. ', items: [{ id: 2 }, 1] }],
      issueItemSentences: [
        { publication: { id: 2 }, sentence: 'Second sentence.' },
        { publication: 1, sentence: 'First sentence.' },
      ],
    });
    expect(issueTextFingerprint(a)).toBe(issueTextFingerprint(b));
  });

  it('changes when a point cites different items', () => {
    const a = readyDoc();
    const b = readyDoc({ issueSummaryPoints: [{ text: 'Point one.', items: [1] }] });
    expect(issueTextFingerprint(a)).not.toBe(issueTextFingerprint(b));
  });
});

describe('applyIssueTextRules', () => {
  const previousKey = process.env.PAYLOAD_API_KEY;
  beforeAll(() => {
    process.env.PAYLOAD_API_KEY = API_KEY;
  });
  afterAll(() => {
    process.env.PAYLOAD_API_KEY = previousKey;
  });

  it('does not bump the revision on a no-op re-save', () => {
    const originalDoc = readyDoc();
    const data = applyIssueTextRules({ data: readyDoc(), originalDoc, req: adminReq });
    expect(data.issueTextRevision).toBe(2);
    expect(data.issueTextSource).toBe('generated');
  });

  it('bumps the revision when the English text changes', () => {
    const originalDoc = readyDoc();
    const data = applyIssueTextRules({
      data: readyDoc({
        issueTextSource: 'generated',
        issueSummaryPoints: [{ text: 'New.', items: [1] }],
      }),
      originalDoc,
      req: headerKeyReq,
    });
    expect(data.issueTextRevision).toBe(3);
  });

  it('treats a missing revision as 0', () => {
    const originalDoc = readyDoc({ issueTextRevision: null });
    const data = applyIssueTextRules({
      data: readyDoc({ issueItemSentences: [] }),
      originalDoc,
      req: headerKeyReq,
    });
    expect(data.issueTextRevision).toBe(1);
  });

  it('resets attempts and error when re-queued to pending', () => {
    const originalDoc = readyDoc({
      issueTextStatus: 'failed',
      issueTextAttempts: 3,
      issueTextError: 'boom',
    });
    const data = applyIssueTextRules({
      data: { ...originalDoc, issueTextStatus: 'pending' },
      originalDoc,
      req: adminReq,
    });
    expect(data).toMatchObject({
      issueTextStatus: 'pending',
      issueTextAttempts: 0,
      issueTextError: null,
      issueTextRevision: 2,
    });
  });

  it.each(['pending', 'failed'] as const)(
    'an owner edit on a %s digest marks it ready and edited',
    (status) => {
      const originalDoc = readyDoc({
        issueTextStatus: status,
        issueTextAttempts: status === 'failed' ? 2 : 0,
        issueTextError: status === 'failed' ? 'bad output' : null,
      });
      const data = applyIssueTextRules({
        data: {
          ...originalDoc,
          issueSummaryPoints: [{ text: 'Hand-written point.', items: [1] }],
        },
        originalDoc,
        req: adminReq,
      });
      expect(data).toMatchObject({
        issueTextStatus: 'ready',
        issueTextSource: 'edited',
        issueTextAttempts: 0,
        issueTextError: null,
        issueTextRevision: 3,
      });
    },
  );

  it('an owner edit on a pre-feature (unset) digest marks it ready and edited', () => {
    const originalDoc = readyDoc({ issueTextStatus: null, issueTextSource: null });
    const data = applyIssueTextRules({
      data: { ...originalDoc, issueItemSentences: [] },
      originalDoc,
      req: adminReq,
    });
    expect(data).toMatchObject({ issueTextStatus: 'ready', issueTextSource: 'edited' });
  });

  it.each([
    ['header key', headerKeyReq],
    ['worker role', workerRoleReq],
  ])('a worker write (%s) keeps generated and its own status', (_label, req) => {
    const originalDoc = readyDoc({ issueTextStatus: 'pending', issueSummaryPoints: [] });
    const data = applyIssueTextRules({
      data: {
        ...originalDoc,
        issueSummaryPoints: [{ text: 'Generated point.', items: [1, 2] }],
        issueTextStatus: 'ready',
        issueTextSource: 'generated',
      },
      originalDoc,
      req,
    });
    expect(data).toMatchObject({
      issueTextStatus: 'ready',
      issueTextSource: 'generated',
      issueTextRevision: 3,
    });
  });

  it('a worker failure write keeps failed and its attempt count', () => {
    const originalDoc = readyDoc({ issueTextStatus: 'pending', issueTextAttempts: 0 });
    const data = applyIssueTextRules({
      data: {
        ...originalDoc,
        issueTextStatus: 'failed',
        issueTextAttempts: 1,
        issueTextError: 'x',
      },
      originalDoc,
      req: headerKeyReq,
    });
    expect(data).toMatchObject({
      issueTextStatus: 'failed',
      issueTextAttempts: 1,
      issueTextError: 'x',
    });
  });

  it('an unauthenticated Local API write is not treated as an owner edit', () => {
    const originalDoc = readyDoc();
    const data = applyIssueTextRules({
      data: { ...originalDoc, issueItemSentences: [] },
      originalDoc,
      req: { user: null, headers: headers() },
    });
    expect(data).toMatchObject({ issueTextSource: 'generated', issueTextRevision: 3 });
  });

  it('an owner edit plus re-queue in the same save → pending wins', () => {
    const originalDoc = readyDoc({ issueTextStatus: 'ready', issueTextAttempts: 0 });
    const data = applyIssueTextRules({
      data: {
        ...originalDoc,
        issueSummaryPoints: [{ text: 'Edited.', items: [1] }],
        issueTextStatus: 'pending',
      },
      originalDoc,
      req: adminReq,
    });
    expect(data).toMatchObject({
      issueTextStatus: 'pending',
      issueTextSource: 'generated',
      issueTextAttempts: 0,
      issueTextRevision: 3,
    });
  });
});

describe('invalidateIssueTranslations', () => {
  function makeReq() {
    const calls: Array<Record<string, unknown>> = [];
    const deleteMany = async (args: Record<string, unknown>) => {
      calls.push(args);
    };
    const req = { payload: { db: { deleteMany } } } as unknown as Parameters<
      typeof invalidateIssueTranslations
    >[2];
    return { req, calls };
  }

  it('deletes the digest translations on the same req when the revision moved', async () => {
    const { req, calls } = makeReq();
    await invalidateIssueTranslations(
      { id: 9, issueTextRevision: 3 },
      { issueTextRevision: 2 },
      req,
    );
    expect(calls).toHaveLength(1);
    expect(calls[0]).toMatchObject({
      collection: 'issue-translations',
      where: { digest: { equals: 9 } },
    });
    expect(calls[0]?.req).toBe(req);
  });

  it('is a no-op when the revision is unchanged', async () => {
    const { req, calls } = makeReq();
    await invalidateIssueTranslations(
      { id: 9, issueTextRevision: 2 },
      { issueTextRevision: 2 },
      req,
    );
    await invalidateIssueTranslations(
      { id: 9, issueTextRevision: 0 },
      { issueTextRevision: null },
      req,
    );
    expect(calls).toHaveLength(0);
  });
});
