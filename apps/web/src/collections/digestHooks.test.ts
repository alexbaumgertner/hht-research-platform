import { capCreateDepth, resolveRelationshipId, stampFeedPublishedAt } from './digestHooks';

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
